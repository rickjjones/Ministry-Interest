let APP_VERSION = '1.0.0';

async function loadAppVersion() {
  try {
    const response = await fetch('./version.json');
    if (!response.ok) return;
    const data = await response.json();
    APP_VERSION = data.version || APP_VERSION;
    const versionElement = document.querySelector('.app-version');
    if (versionElement) {
      versionElement.textContent = `Version: ${APP_VERSION}`;
      printf('App version updated to: %s', APP_VERSION);
    }
  } catch (error) {
    console.warn('Unable to load app version:', error);
  }
}

const form = document.getElementById('personForm');
const nameInput = document.getElementById('name');
const contactInput = document.getElementById('contact');
const notesInput = document.getElementById('notes');
const followUpInput = document.getElementById('followUp');
const clearButton = document.getElementById('clearButton');
const peopleList = document.getElementById('peopleList');
const count = document.getElementById('count');
const installButton = document.getElementById('installButton');
const savePersonButton = document.getElementById('savePersonButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const exportCsvButton = document.getElementById('exportCsvButton');
const importCsvInput = document.getElementById('importCsvInput');
const template = document.getElementById('personTemplate');
const initialLocationInput = document.getElementById('initialLocation');
const getInitialLocationButton = document.getElementById('getInitialLocationButton');
const initialLocationStatus = document.getElementById('initialLocationStatus');
const visitModal = document.getElementById('visitModal');
const visitForm = document.getElementById('visitForm');
const visitPersonNameInput = document.getElementById('visitPersonName');
const visitDateInput = document.getElementById('visitDate');
const visitNotesInput = document.getElementById('visitNotes');
const visitLocationInput = document.getElementById('visitLocation');
const getLocationButton = document.getElementById('getLocationButton');
const locationStatus = document.getElementById('locationStatus');
const modalSubmitButton = document.querySelector('.modal-submit');
const modalCancelButton = document.querySelector('.modal-cancel');

let deferredPrompt = null;
let people = [];
let currentEditingPersonId = null;
let currentVisitPersonId = null;
let currentLocationCoords = null;
let locationContext = null; // 'initial' or 'visit'
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function generateId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function findPerson(id) {
  return people.find((person) => person.id === id);
}

function loadPeople() {
  const saved = window.localStorage.getItem('ministryPeople');
  people = saved ? JSON.parse(saved) : [];

  // Give records saved before IDs existed a stable ID.
  let migrated = false;
  people.forEach((person) => {
    if (!person.id) {
      person.id = generateId();
      migrated = true;
    }
  });
  if (migrated) savePeople();
}

function savePeople() {
  window.localStorage.setItem('ministryPeople', JSON.stringify(people));
}

// Date inputs produce "YYYY-MM-DD". `new Date("YYYY-MM-DD")` parses that as UTC
// midnight, which shows as the previous day west of UTC, so build a local date instead.
function parseLocalDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDate(value) {
  const date = parseLocalDate(value);
  if (!date) return value || '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function todayLocalIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatFollowUp(date) {
  if (!date) return 'No follow-up date';
  return formatLocalDate(date);
}

function openNavigation(destination) {
  if (!destination) return;

  const coordinateMatch = destination.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  const isAppleDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroidDevice = /Android/i.test(navigator.userAgent);

  let url;

  if (coordinateMatch) {
    const [, latitude, longitude] = coordinateMatch;
    if (isAppleDevice) {
      url = `https://maps.apple.com/?daddr=${latitude},${longitude}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    }
  } else {
    const encodedDestination = encodeURIComponent(destination);
    if (isAppleDevice) {
      url = `https://maps.apple.com/?daddr=${encodedDestination}`;
    } else if (isAndroidDevice) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

async function getLocation() {
  const isInitial = locationContext === 'initial';
  const locationInputEl = isInitial ? initialLocationInput : visitLocationInput;
  const statusEl = isInitial ? initialLocationStatus : locationStatus;
  const buttonEl = isInitial ? getInitialLocationButton : getLocationButton;

  if (!navigator.geolocation) {
    statusEl.textContent = 'Geolocation is not supported by your browser';
    statusEl.className = 'location-status error';
    return;
  }

  statusEl.textContent = 'Getting location...';
  statusEl.className = 'location-status loading';
  buttonEl.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      currentLocationCoords = { latitude, longitude };
      await reverseGeocode(latitude, longitude);
    },
    (error) => {
      let message = 'Unable to get location';
      if (error.code === error.PERMISSION_DENIED) {
        message = 'Location permission denied. Check your browser settings.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = 'Location information is unavailable.';
      } else if (error.code === error.TIMEOUT) {
        message = 'Location request timed out.';
      }
      statusEl.textContent = message;
      statusEl.className = 'location-status error';
      buttonEl.disabled = false;
    }
  );
}

async function reverseGeocode(latitude, longitude) {
  const isInitial = locationContext === 'initial';
  const locationInputEl = isInitial ? initialLocationInput : visitLocationInput;
  const statusEl = isInitial ? initialLocationStatus : locationStatus;
  const buttonEl = isInitial ? getInitialLocationButton : getLocationButton;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );
    const data = await response.json();
    
    // Extract address components
    const address = data.address || {};
    const addressLine = data.address_line || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    
    locationInputEl.value = addressLine;
    statusEl.textContent = '✓ Location captured';
    statusEl.className = 'location-status success';
    buttonEl.disabled = false;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Fallback to coordinates if API fails
    locationInputEl.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    statusEl.textContent = '✓ Location captured (coordinates)';
    statusEl.className = 'location-status success';
    buttonEl.disabled = false;
  }
}

function renderPeople() {
  peopleList.innerHTML = '';
  count.textContent = `${people.length} tracked`;

  if (!people.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'No people tracked yet. Add someone to begin your ministry follow-up plan.';
    emptyMessage.className = 'person-notes';
    peopleList.appendChild(emptyMessage);
    return;
  }

  people.forEach((person) => {
    const personId = person.id;
    const item = template.content.cloneNode(true);
    item.querySelector('.person-name').textContent = person.name;
    item.querySelector('.person-contact').textContent = person.contact;
    item.querySelector('.person-notes').textContent = person.notes || 'No notes provided.';
    item.querySelector('.person-followup').textContent = formatFollowUp(person.followUp);
    
    // Display initial location if available
    const initialLocationBadge = item.querySelector('.initial-location-badge');
    if (person.location) {
      initialLocationBadge.textContent = `📍 ${person.location}`;
    }

    item.querySelector('.edit-button').addEventListener('click', () => {
      startEditingPerson(personId);
    });

    const navigateButton = item.querySelector('.navigate-button');
    if (person.location) {
      navigateButton.disabled = false;
      navigateButton.addEventListener('click', () => {
        openNavigation(person.location);
      });
    } else {
      navigateButton.disabled = true;
    }
    
    // Set up delete button
    item.querySelector('.delete-button').addEventListener('click', () => {
      people = people.filter((p) => p.id !== personId);
      if (currentEditingPersonId === personId) {
        cancelEditingPerson();
      }
      savePeople();
      renderPeople();
    });

    // Set up log visit button
    item.querySelector('.log-visit-button').addEventListener('click', () => {
      openVisitModal(personId);
    });

    // Handle visit history display
    const visits = person.visits || [];
    const visitHistoryContainer = item.querySelector('.visit-history-container');
    const visitCount = item.querySelector('.visit-count');
    const visitList = item.querySelector('.visit-list');

    if (visits.length > 0) {
      visitHistoryContainer.style.display = 'block';
      visitCount.textContent = visits.length;
      visitList.innerHTML = '';
      
      visits.forEach((visit) => {
        const visitItem = document.createElement('li');
        visitItem.className = 'visit-item';
        let locationHtml = '';
        if (visit.location) {
          locationHtml = `<div class="visit-location">📍 ${visit.location}</div>`;
        }
        visitItem.innerHTML = `
          <span class="visit-date">${formatLocalDate(visit.date)}</span>
          <p class="visit-note">${visit.notes}</p>
          ${locationHtml}
        `;
        visitList.appendChild(visitItem);
      });
    } else {
      visitHistoryContainer.style.display = 'none';
    }

    peopleList.appendChild(item);
  });
}

function resetPersonForm() {
  form.reset();
  initialLocationInput.value = '';
  initialLocationStatus.textContent = '';
  initialLocationStatus.className = 'location-status';
  getInitialLocationButton.disabled = false;
  savePersonButton.textContent = 'Save Person';
  cancelEditButton.hidden = true;
}

function cancelEditingPerson() {
  currentEditingPersonId = null;
  resetPersonForm();
  nameInput.focus();
}

function startEditingPerson(id) {
  const person = findPerson(id);
  if (!person) return;

  currentEditingPersonId = id;
  nameInput.value = person.name || '';
  contactInput.value = person.contact || '';
  notesInput.value = person.notes || '';
  followUpInput.value = person.followUp || '';
  initialLocationInput.value = person.location || '';
  initialLocationStatus.textContent = person.location ? '✓ Existing location loaded' : '';
  initialLocationStatus.className = person.location ? 'location-status success' : 'location-status';
  savePersonButton.textContent = 'Update Person';
  cancelEditButton.hidden = false;
  nameInput.focus();
}

function addPerson(event) {
  event.preventDefault();

  const personValues = {
    name: nameInput.value.trim(),
    contact: contactInput.value.trim(),
    notes: notesInput.value.trim(),
    followUp: followUpInput.value,
  };

  if (currentEditingPersonId !== null) {
    const personToUpdate = findPerson(currentEditingPersonId);
    if (!personToUpdate) {
      // The record was removed while being edited; don't overwrite anyone else.
      cancelEditingPerson();
      return;
    }

    personToUpdate.name = personValues.name;
    personToUpdate.contact = personValues.contact;
    personToUpdate.notes = personValues.notes;
    personToUpdate.followUp = personValues.followUp;
    personToUpdate.updatedAt = Date.now();

    if (initialLocationInput.value.trim()) {
      personToUpdate.location = initialLocationInput.value.trim();
    } else {
      delete personToUpdate.location;
    }

    savePeople();
    renderPeople();
    cancelEditingPerson();
    return;
  }

  const newPerson = {
    id: generateId(),
    ...personValues,
    createdAt: Date.now(),
    visits: [],
  };

  // Include initial location if provided
  if (initialLocationInput.value.trim()) {
    newPerson.location = initialLocationInput.value.trim();
  }

  people.unshift(newPerson);
  savePeople();
  renderPeople();
  resetPersonForm();
  nameInput.focus();
}

function clearAll() {
  const confirmed = window.confirm('Clear all tracked people? This cannot be undone.');
  if (!confirmed) return;
  people = [];
  savePeople();
  renderPeople();
  if (currentEditingPersonId !== null) cancelEditingPerson();
}

const CSV_HEADER = ['id', 'name', 'contact', 'notes', 'followUp', 'location', 'createdAt', 'updatedAt', 'visits'];

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// RFC 4180 parser: handles quoted fields containing commas, quotes and line breaks.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((value) => value.trim() !== ''));
}

// Visits are exported as JSON. Older backups used "date:… | notes:… | location:…" joined by " || ".
function parseVisits(value) {
  if (!value) return [];
  const trimmed = value.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((visit) => visit && typeof visit === 'object')
          .map((visit) => {
            const clean = { date: String(visit.date || ''), notes: String(visit.notes || '') };
            if (visit.location) clean.location = String(visit.location);
            return clean;
          });
      }
    } catch (error) {
      console.warn('Could not parse visits JSON, trying legacy format:', error);
    }
  }

  return trimmed.split(' || ').map((chunk) => {
    const visit = { date: '', notes: '' };
    chunk.split(' | ').forEach((part) => {
      const match = /^(date|notes|location):([\s\S]*)$/.exec(part);
      if (match) visit[match[1]] = match[2];
    });
    return visit;
  }).filter((visit) => visit.date || visit.notes || visit.location);
}

function personKey(person) {
  return `${person.name}|${person.contact}|${person.createdAt}`.toLowerCase();
}

function exportPeopleToCsv() {
  const rows = people.map((person) => [
    person.id,
    person.name,
    person.contact,
    person.notes,
    person.followUp,
    person.location,
    person.createdAt,
    person.updatedAt,
    JSON.stringify(person.visits || []),
  ].map(escapeCsvValue).join(','));

  // Leading BOM so spreadsheet apps read the file as UTF-8.
  const csvContent = `﻿${[CSV_HEADER.join(','), ...rows].join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ministry-interest-backup-${todayLocalIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importPeopleFromCsv(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    importCsvInput.value = ''; // allow choosing the same file again
    const text = event.target?.result;
    if (typeof text !== 'string') return;

    const rows = parseCsv(text.replace(/^﻿/, ''));
    if (rows.length < 2) {
      window.alert('No valid people records were found in the selected CSV file.');
      return;
    }

    // Map columns by header name so older backups (without an id column) still import.
    const header = rows[0].map((name) => name.trim());
    const column = (name) => header.indexOf(name);
    if (column('name') === -1) {
      window.alert('This file does not look like a Ministry Interest backup (missing a "name" column).');
      return;
    }
    const read = (row, name) => {
      const index = column(name);
      return index === -1 ? '' : (row[index] || '');
    };

    const parsedPeople = rows.slice(1).map((row) => {
      const createdAt = Number(read(row, 'createdAt'));
      const updatedAt = Number(read(row, 'updatedAt'));
      const person = {
        id: read(row, 'id').trim() || generateId(),
        name: read(row, 'name'),
        contact: read(row, 'contact'),
        notes: read(row, 'notes'),
        followUp: read(row, 'followUp'),
        createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
        visits: parseVisits(read(row, 'visits')),
      };
      if (Number.isFinite(updatedAt) && updatedAt > 0) person.updatedAt = updatedAt;
      const location = read(row, 'location');
      if (location) person.location = location;
      return person;
    }).filter((person) => person.name || person.contact || person.notes);

    if (!parsedPeople.length) {
      window.alert('No valid people records were found in the selected CSV file.');
      return;
    }

    // Skip records that are already in the list (same id, or same name/contact/created time).
    const existingIds = new Set(people.map((person) => person.id));
    const existingKeys = new Set(people.map(personKey));
    const newPeople = [];
    parsedPeople.forEach((person) => {
      if (existingIds.has(person.id) || existingKeys.has(personKey(person))) return;
      existingIds.add(person.id);
      existingKeys.add(personKey(person));
      newPeople.push(person);
    });
    const skipped = parsedPeople.length - newPeople.length;

    if (!newPeople.length) {
      window.alert(`All ${parsedPeople.length} record(s) in this file are already in your list.`);
      return;
    }

    const skippedNote = skipped ? ` ${skipped} record(s) already in your list will be skipped.` : '';
    const confirmed = window.confirm(`Import ${newPeople.length} new record(s) from this CSV file?${skippedNote}`);
    if (!confirmed) return;

    people = [...newPeople, ...people];
    savePeople();
    renderPeople();
  };

  reader.readAsText(file);
}

function openVisitModal(personId) {
  const person = findPerson(personId);
  if (!person) return;
  currentVisitPersonId = personId;
  visitPersonNameInput.value = person.name;
  visitDateInput.value = todayLocalIso();
  visitNotesInput.value = '';
  visitLocationInput.value = '';
  locationStatus.textContent = '';
  locationStatus.className = 'location-status';
  getLocationButton.disabled = false;
  currentLocationCoords = null;
  visitModal.showModal();
}

function closeVisitModal() {
  visitModal.close();
  currentVisitPersonId = null;
  visitForm.reset();
}

function saveVisit(event) {
  event.preventDefault();

  const person = findPerson(currentVisitPersonId);
  if (!person) {
    closeVisitModal();
    return;
  }

  const visit = {
    date: visitDateInput.value,
    notes: visitNotesInput.value.trim(),
  };

  // Include location if available
  if (visitLocationInput.value.trim()) {
    visit.location = visitLocationInput.value.trim();
  }

  if (!person.visits) {
    person.visits = [];
  }

  // Add visit to the beginning (most recent first)
  person.visits.unshift(visit);
  
  savePeople();
  renderPeople();
  closeVisitModal();
}

form.addEventListener('submit', addPerson);
cancelEditButton.addEventListener('click', cancelEditingPerson);
clearButton.addEventListener('click', clearAll);
exportCsvButton.addEventListener('click', exportPeopleToCsv);
importCsvInput.addEventListener('change', (event) => {
  importPeopleFromCsv(event.target.files?.[0]);
});
visitForm.addEventListener('submit', saveVisit);
modalCancelButton.addEventListener('click', closeVisitModal);

getInitialLocationButton.addEventListener('click', (e) => {
  e.preventDefault();
  locationContext = 'initial';
  getLocation();
});

getLocationButton.addEventListener('click', (e) => {
  e.preventDefault();
  locationContext = 'visit';
  getLocation();
});

// Close modal when clicking outside of it
visitModal.addEventListener('click', (event) => {
  if (event.target === visitModal) {
    closeVisitModal();
  }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (isIOS && !isInStandaloneMode) {
    installButton.textContent = 'Open in Safari';
    window.open('https://www.apple.com/iphone/', '_blank', 'noopener,noreferrer');
    window.alert('On iPhone, open this app in Safari and tap Share > Add to Home Screen to install it.');
    return;
  }

  if (!deferredPrompt) {
    installButton.textContent = 'Install unavailable';
    window.alert('Install is not available on this device right now. Try opening the app in a supported browser.');
    return;
  }

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    console.log('PWA installation accepted');
  }
  installButton.hidden = true;
  deferredPrompt = null;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Reload once when a new service worker takes over so the fresh app files are used.
      const hadController = Boolean(navigator.serviceWorker.controller);
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
      });
      const registration = await navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' });
      registration.update().catch(() => {});
      console.log('Service Worker registered');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

if (isIOS && !isInStandaloneMode) {
  installButton.hidden = false;
  installButton.textContent = 'Install on iPhone';
} else if (!isInStandaloneMode) {
  installButton.hidden = false;
}

loadPeople();
renderPeople();
