
const $ = (selector) => document.querySelector(selector);

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }
};

let signup = false;

$('#toggle').addEventListener('click', (event) => {
  event.preventDefault();

  signup = !signup;

  $('#ltitle').textContent = signup
    ? 'Create account'
    : 'Sign in';

  $('#lbtn').textContent = signup
    ? 'Create account'
    : 'Sign in';

  event.currentTarget.textContent = signup
    ? 'I already have an account'
    : 'Create an account instead';

  $('#lerr').textContent = '';
});

function signIn() {
  const email = $('#em').value.trim();
  const password = $('#pw').value;

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    $('#lerr').textContent =
      'Enter a valid email address.';
    return;
  }

  if (password.length < 4) {
    $('#lerr').textContent =
      'Password needs at least 4 characters.';
    return;
  }

  // Demo-only authentication.
  // Stores the email in this browser.
  store.set('probe.user', email);

  window.location.href = 'dashboard.html';
}

$('#lbtn').addEventListener('click', signIn);

$('#pw').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    signIn();
  }
});

// If a demo session already exists,
// open the dashboard.
if (store.get('probe.user', null)) {
  window.location.replace('dashboard.html');
}
