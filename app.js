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
let currentEditingPersonIndex = null;
let currentVisitPersonIndex = null;
let currentLocationCoords = null;
let locationContext = null; // 'initial' or 'visit'

function loadPeople() {
  const saved = window.localStorage.getItem('ministryPeople');
  people = saved ? JSON.parse(saved) : [];
}

function savePeople() {
  window.localStorage.setItem('ministryPeople', JSON.stringify(people));
}

function formatFollowUp(date) {
  if (!date) return 'No follow-up date';
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

  people.forEach((person, index) => {
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
      startEditingPerson(index);
    });
    
    // Set up delete button
    item.querySelector('.delete-button').addEventListener('click', () => {
      people.splice(index, 1);
      if (currentEditingPersonIndex === index) {
        cancelEditingPerson();
      }
      savePeople();
      renderPeople();
    });

    // Set up log visit button
    item.querySelector('.log-visit-button').addEventListener('click', () => {
      openVisitModal(index);
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
          <span class="visit-date">${new Date(visit.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
  currentEditingPersonIndex = null;
  resetPersonForm();
  nameInput.focus();
}

function startEditingPerson(index) {
  const person = people[index];
  if (!person) return;

  currentEditingPersonIndex = index;
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

  if (currentEditingPersonIndex !== null) {
    const personToUpdate = people[currentEditingPersonIndex];
    if (!personToUpdate) return;

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
}

function openVisitModal(personIndex) {
  currentVisitPersonIndex = personIndex;
  visitPersonNameInput.value = people[personIndex].name;
  visitDateInput.value = new Date().toISOString().split('T')[0]; // Set to today
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
  currentVisitPersonIndex = null;
  visitForm.reset();
}

function saveVisit(event) {
  event.preventDefault();
  
  if (currentVisitPersonIndex === null) return;

  const visit = {
    date: visitDateInput.value,
    notes: visitNotesInput.value.trim(),
  };

  // Include location if available
  if (visitLocationInput.value.trim()) {
    visit.location = visitLocationInput.value.trim();
  }

  if (!people[currentVisitPersonIndex].visits) {
    people[currentVisitPersonIndex].visits = [];
  }

  // Add visit to the beginning (most recent first)
  people[currentVisitPersonIndex].visits.unshift(visit);
  
  savePeople();
  renderPeople();
  closeVisitModal();
}

form.addEventListener('submit', addPerson);
cancelEditButton.addEventListener('click', cancelEditingPerson);
clearButton.addEventListener('click', clearAll);
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
  if (!deferredPrompt) return;
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
      await navigator.serviceWorker.register('service-worker.js');
      console.log('Service Worker registered');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

loadPeople();
renderPeople();
