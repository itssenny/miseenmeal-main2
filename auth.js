import { isSupabaseConfigured, supabase } from './supabase-client.js';

const authView = document.querySelector('#auth-view');
const appShell = document.querySelector('#app-shell');
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
const authSubmit = document.querySelector('#auth-submit');
const authTitle = document.querySelector('#auth-title');
const authCopy = document.querySelector('#auth-copy');
const accountEmail = document.querySelector('#account-email');
const profileButton = document.querySelector('#profile-button');
let authMode = 'signin';

function setMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle('error', isError);
}

function setBusy(busy) {
  authSubmit.disabled = busy;
  authSubmit.textContent = busy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in';
}

function setMode(mode) {
  authMode = mode;
  document.querySelectorAll('[data-auth-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.authMode === mode);
  });
  const password = authForm.elements.password;
  password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  authTitle.textContent = mode === 'signup' ? 'Create your kitchen.' : 'Welcome back.';
  authCopy.textContent = mode === 'signup' ? 'Use your email to create an account.' : 'Sign in to open your kitchen.';
  setMessage('');
  setBusy(false);
}

function showSession(session) {
  const user = session?.user;
  authView.hidden = Boolean(user);
  appShell.hidden = !user;
  window.dispatchEvent(new CustomEvent('mise-auth-change', { detail: { session } }));
  if (!user) {
    accountEmail.textContent = '';
    return;
  }
  accountEmail.textContent = user.email || '';
  profileButton.textContent = (user.email || 'MM').slice(0, 2).toUpperCase();
  setMessage('');
}

document.querySelectorAll('[data-auth-mode]').forEach(button => {
  button.addEventListener('click', () => setMode(button.dataset.authMode));
});

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) return setMessage('Supabase is not configured for this site.', true);
  const data = new FormData(authForm);
  const email = data.get('email').trim();
  const password = data.get('password');
  setBusy(true);
  setMessage('');

  const result = authMode === 'signup'
    ? await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
      })
    : await supabase.auth.signInWithPassword({ email, password });

  setBusy(false);
  if (result.error) return setMessage(result.error.message, true);
  if (authMode === 'signup' && !result.data.session) {
    setMessage('Account created. Check your email to confirm your address, then sign in.');
    return;
  }
  showSession(result.data.session);
});

if (!isSupabaseConfigured) {
  showSession(null);
  setMessage('Supabase is not configured for this site.', true);
  authForm.querySelectorAll('input, button').forEach(control => control.disabled = true);
} else {
  supabase.auth.onAuthStateChange((_event, session) => showSession(session));
  const { data, error } = await supabase.auth.getSession();
  if (error) setMessage(error.message, true);
  showSession(data.session);
}
