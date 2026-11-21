// version.json is the single source of truth for the app version.
async function loadAppVersion() {
  const versionElement = document.querySelector('.app-version');
  try {
    const response = await fetch('./version.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (versionElement && data.version) {
      versionElement.textContent = `Version: ${data.version}`;
    }
  } catch (error) {
    console.warn('Unable to load app version:', error);
    if (versionElement) versionElement.textContent = '';
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
const backupStatus = document.getElementById('backupStatus');
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
const visitModalTitle = document.getElementById('visitModalTitle');
const modalCancelButton = document.querySelector('.modal-cancel');

let deferredPrompt = null;
let people = [];
let currentEditingPersonId = null;
let currentVisitPersonId = null;
let currentEditingVisitIndex = null;
// iPadOS reports itself as a Mac, so also check for a touch screen.
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function findPerson(id) {
  return people.find((person) => person.id === id);
}

const STORAGE_KEY = 'ministryPeople';
const LAST_BACKUP_KEY = 'ministryLastBackupAt';
const BACKUP_REMINDER_DAYS = 14;

function loadPeople() {
  let saved;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error('Unable to read saved people:', error);
    window.alert('This browser is blocking storage, so your list cannot be loaded or saved here.');
    people = [];
    return;
  }

  try {
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) throw new Error('Saved data is not a list');
    people = parsed.filter((person) => person && typeof person === 'object');
  } catch (error) {
    // Keep the unreadable data under a separate key instead of losing it, then start fresh.
    console.error('Saved data could not be read:', error);
    const backupKey = `${STORAGE_KEY}.unreadable-${Date.now()}`;
    try {
      window.localStorage.setItem(backupKey, saved);
    } catch (backupError) {
      console.error('Unable to keep a copy of the unreadable data:', backupError);
    }
    window.alert(
      `Your saved list could not be read, so the app is starting with an empty list.\n\n` +
      `The original data was kept in browser storage as "${backupKey}". ` +
      `If you have a CSV backup, use Import CSV to restore it.`
    );
    people = [];
  }

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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
    return true;
  } catch (error) {
    console.error('Unable to save people:', error);
    window.alert('Your latest change could not be saved (storage may be full or blocked). Export a CSV backup now to avoid losing data.');
    return false;
  }
}

// Ask the browser not to clear this app's storage automatically (e.g. Safari after 7 days unused).
async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try {
    const alreadyPersisted = await navigator.storage.persisted();
    if (alreadyPersisted) return;
    const granted = await navigator.storage.persist();
    console.log(`Persistent storage ${granted ? 'granted' : 'not granted'}`);
  } catch (error) {
    console.warn('Unable to request persistent storage:', error);
  }
}

function getLastBackupAt() {
  try {
    const value = Number(window.localStorage.getItem(LAST_BACKUP_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function updateBackupStatus() {
  if (!backupStatus) return;
  const lastBackupAt = getLastBackupAt();
  const daysSince = lastBackupAt ? Math.floor((Date.now() - lastBackupAt) / 86400000) : null;
  const overdue = people.length > 0 && (daysSince === null || daysSince >= BACKUP_REMINDER_DAYS);

  if (!lastBackupAt) {
    backupStatus.textContent = people.length
      ? 'No backup yet. Your list is only stored on this device, so export a CSV to keep a copy.'
      : '';
  } else {
    const when = new Date(lastBackupAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    backupStatus.textContent = overdue
      ? `Last backup: ${when} (${daysSince} days ago). Consider exporting a new CSV.`
      : `Last backup: ${when}`;
  }
  backupStatus.classList.toggle('overdue', overdue);
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

function setLocationStatus(statusEl, message, state = '') {
  statusEl.textContent = message;
  statusEl.className = state ? `location-status ${state}` : 'location-status';
}

// Look up a street address for coordinates. Returns null if no address is available.
async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
    addressdetails: '0',
    'accept-language': navigator.language || 'en',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
  if (!response.ok) throw new Error(`Geocoding failed with HTTP ${response.status}`);
  const data = await response.json();
  return data.display_name || null;
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

function describeGeolocationError(error) {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission denied. Check your browser settings.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'Location information is unavailable.';
  if (error.code === error.TIMEOUT) return 'Location request timed out.';
  return 'Unable to get location';
}

// Fill `input` with the current address (or coordinates if no address is found).
async function captureLocation({ input, status, button }) {
  if (!navigator.geolocation) {
    setLocationStatus(status, 'Geolocation is not supported by your browser', 'error');
    return;
  }

  setLocationStatus(status, 'Getting location...', 'loading');
  button.disabled = true;

  try {
    let position;
    try {
      position = await getCurrentPosition();
    } catch (error) {
      setLocationStatus(status, describeGeolocationError(error), 'error');
      return;
    }

    const { latitude, longitude } = position.coords;
    const coordinates = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    try {
      const address = await reverseGeocode(latitude, longitude);
      input.value = address || coordinates;
      setLocationStatus(status, address ? '✓ Location captured' : '✓ Location captured (coordinates)', 'success');
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      input.value = coordinates;
      setLocationStatus(status, '✓ Location captured (coordinates)', 'success');
    }
  } finally {
    button.disabled = false;
  }
}

function renderPeople() {
  // Remember which visit histories are expanded so re-rendering doesn't collapse them.
  const openVisitHistoryIds = new Set(
    [...peopleList.querySelectorAll('.person-card .visit-details[open]')]
      .map((details) => details.closest('.person-card')?.dataset.id)
      .filter(Boolean)
  );
  peopleList.innerHTML = '';
  count.textContent = `${people.length} tracked`;
  updateBackupStatus();

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
    item.querySelector('.person-card').dataset.id = personId;
    item.querySelector('.person-name').textContent = person.name;
    item.querySelector('.person-contact').textContent = person.contact;
    item.querySelector('.person-notes').textContent = person.notes || 'No notes provided.';
    item.querySelector('.person-followup').textContent = person.followUp
      ? `Follow up: ${formatFollowUp(person.followUp)}`
      : formatFollowUp(person.followUp);
    
    // Display initial location if available
    const initialLocationBadge = item.querySelector('.initial-location-badge');
    if (person.location) {
      initialLocationBadge.textContent = `📍 ${person.location}`;
    }

    item.querySelector('.edit-button').addEventListener('click', () => {
      startEditingPerson(personId);
    });

    // Only offer directions when there's somewhere to go.
    const navigateButton = item.querySelector('.navigate-button');
    if (person.location) {
      navigateButton.setAttribute('aria-label', `Directions to ${person.location}`);
      navigateButton.addEventListener('click', () => {
        openNavigation(person.location);
      });
    } else {
      navigateButton.hidden = true;
    }
    
    // Set up delete button
    item.querySelector('.delete-button').addEventListener('click', () => {
      const visitNote = person.visits?.length ? ` and their ${person.visits.length} logged visit(s)` : '';
      if (!window.confirm(`Remove ${person.name || 'this person'}${visitNote}? This cannot be undone.`)) return;
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
      item.querySelector('.visit-details').open = openVisitHistoryIds.has(personId);

      // Build with textContent so user-entered text is never interpreted as HTML.
      visits.forEach((visit, visitIndex) => {
        const visitItem = document.createElement('li');
        visitItem.className = 'visit-item';

        const dateEl = document.createElement('span');
        dateEl.className = 'visit-date';
        dateEl.textContent = formatLocalDate(visit.date);

        const noteEl = document.createElement('p');
        noteEl.className = 'visit-note';
        noteEl.textContent = visit.notes || '';

        visitItem.append(dateEl, noteEl);

        if (visit.location) {
          const locationEl = document.createElement('div');
          locationEl.className = 'visit-location';
          locationEl.textContent = `📍 ${visit.location}`;
          visitItem.append(locationEl);
        }

        const visitActions = document.createElement('div');
        visitActions.className = 'visit-actions';

        const editVisitButton = document.createElement('button');
        editVisitButton.type = 'button';
        editVisitButton.className = 'visit-action';
        editVisitButton.textContent = 'Edit';
        editVisitButton.setAttribute('aria-label', 'Edit visit');
        editVisitButton.addEventListener('click', () => openVisitModal(personId, visitIndex));

        const deleteVisitButton = document.createElement('button');
        deleteVisitButton.type = 'button';
        deleteVisitButton.className = 'visit-action danger';
        deleteVisitButton.textContent = 'Delete';
        deleteVisitButton.setAttribute('aria-label', 'Delete visit');
        deleteVisitButton.addEventListener('click', () => deleteVisit(personId, visitIndex));

        visitActions.append(editVisitButton, deleteVisitButton);
        visitItem.append(visitActions);

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
  setLocationStatus(initialLocationStatus, '');
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
  setLocationStatus(initialLocationStatus, person.location ? '✓ Existing location loaded' : '', person.location ? 'success' : '');
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
  const csvContent = `\uFEFF${[CSV_HEADER.join(','), ...rows].join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ministry-interest-backup-${todayLocalIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  } catch (error) {
    console.warn('Unable to record backup time:', error);
  }
  updateBackupStatus();
}

function importPeopleFromCsv(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    importCsvInput.value = ''; // allow choosing the same file again
    const text = event.target?.result;
    if (typeof text !== 'string') return;

    const rows = parseCsv(text.replace(/^\uFEFF/, ''));
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

// Pass a visitIndex to edit an existing visit; omit it to log a new one.
function openVisitModal(personId, visitIndex = null) {
  const person = findPerson(personId);
  if (!person) return;
  const existingVisit = visitIndex !== null ? person.visits?.[visitIndex] : null;
  if (visitIndex !== null && !existingVisit) return;

  currentVisitPersonId = personId;
  currentEditingVisitIndex = visitIndex;
  visitModalTitle.textContent = existingVisit ? 'Edit Visit' : 'Log a Visit';
  modalSubmitButton.textContent = existingVisit ? 'Update Visit' : 'Save Visit';
  visitPersonNameInput.value = person.name;
  visitDateInput.value = existingVisit?.date || todayLocalIso();
  visitNotesInput.value = existingVisit?.notes || '';
  visitLocationInput.value = existingVisit?.location || '';
  setLocationStatus(locationStatus, '');
  getLocationButton.disabled = false;
  visitModal.showModal();
}

function closeVisitModal() {
  visitModal.close();
  currentVisitPersonId = null;
  currentEditingVisitIndex = null;
  visitForm.reset();
}

function deleteVisit(personId, visitIndex) {
  const person = findPerson(personId);
  const visit = person?.visits?.[visitIndex];
  if (!visit) return;
  const when = visit.date ? ` from ${formatLocalDate(visit.date)}` : '';
  if (!window.confirm(`Delete the visit${when} for ${person.name || 'this person'}? This cannot be undone.`)) return;
  person.visits.splice(visitIndex, 1);
  savePeople();
  renderPeople();
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

  if (currentEditingVisitIndex !== null && person.visits[currentEditingVisitIndex]) {
    person.visits[currentEditingVisitIndex] = visit;
  } else {
    // Add visit to the beginning (most recent first)
    person.visits.unshift(visit);
  }

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
  captureLocation({ input: initialLocationInput, status: initialLocationStatus, button: getInitialLocationButton });
});

getLocationButton.addEventListener('click', (e) => {
  e.preventDefault();
  captureLocation({ input: visitLocationInput, status: locationStatus, button: getLocationButton });
});

// Close modal when clicking outside of it
visitModal.addEventListener('click', (event) => {
  if (event.target === visitModal) {
    closeVisitModal();
  }
});

// The install button only appears when installing is actually possible:
// - Chrome/Edge/Android fire `beforeinstallprompt`, and we show the native prompt.
// - iOS/iPadOS have no prompt API, so we show "Add to Home Screen" instructions instead.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.textContent = 'Install App';
  installButton.hidden = false;
});

window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  deferredPrompt = null;
});

installButton.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    installButton.hidden = true;
    deferredPrompt = null;
    return;
  }

  if (isIOS) {
    window.alert('To install: tap the Share button (the square with an arrow), then choose "Add to Home Screen".');
  }
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
  installButton.textContent = 'How to Install';
  installButton.hidden = false;
}

loadPeople();
renderPeople();
loadAppVersion();
requestPersistentStorage();
