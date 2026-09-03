import { supabase } from './supabase-client.js';

const profileView = document.querySelector('#profile-view');
const profileButton = document.querySelector('#profile-button');
const cuisines = ['Italian', 'Japanese', 'Chinese', 'Mexican', 'Korean', 'Mediterranean', 'Indian', 'Thai', 'French', 'Middle Eastern'];
let session = null;
let profile = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

function initials() {
  const source = profile?.display_name || profile?.username || session?.user?.email || 'MM';
  return source.split(/\s+|@/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function avatarMarkup(className = 'profile-avatar') {
  return profile?.avatar_url
    ? `<img class="${className}" src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(profile.display_name || 'Profile')} avatar">`
    : `<div class="${className} profile-avatar-fallback" aria-hidden="true">${escapeHtml(initials())}</div>`;
}

function updateHeaderAvatar() {
  if (!profileButton) return;
  if (profile?.avatar_url) {
    profileButton.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="">`;
  } else {
    profileButton.textContent = initials();
  }
}

async function loadProfile() {
  if (!session?.user) return;
  profileView.innerHTML = '<div class="profile-loading">Setting the table…</div>';
  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error) throw error;
  if (data) profile = data;
  else {
    const fallbackName = session.user.user_metadata?.display_name || '';
    const created = await supabase.from('profiles').insert({ id: session.user.id, display_name: fallbackName, created_at: session.user.created_at }).select().single();
    if (created.error) throw created.error;
    profile = created.data;
  }
  updateHeaderAvatar();
  renderProfile();
}

function renderProfile() {
  const name = profile.display_name || 'Your name';
  const username = profile.username ? `@${profile.username}` : '@choose_a_username';
  const tastes = profile.favorite_cuisines || [];
  const memberSince = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(session.user.created_at));
  profileView.innerHTML = `
    <div class="profile-page">
      <section class="profile-card">
        <div class="profile-wash" aria-hidden="true"></div>
        <div class="profile-identity">
          ${avatarMarkup()}
          <div class="profile-copy">
            <p class="eyebrow">MY KITCHEN</p>
            <h1>${escapeHtml(name)}</h1>
            <p class="profile-handle">${escapeHtml(username)}</p>
            ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : '<p class="profile-bio profile-empty">Add a little about what you love to cook.</p>'}
            <div class="profile-tags"><span>${escapeHtml(profile.diet_preference)}</span><i>·</i><span>${escapeHtml(profile.cooking_level)}</span></div>
            ${tastes.length ? `<div class="cuisine-list">${tastes.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="profile-actions">
            <button class="primary-btn" data-profile-action="edit">Edit Profile</button>
            <button class="secondary-btn" data-profile-action="logout">Log Out</button>
          </div>
        </div>
        <div class="profile-footer">
          <div class="profile-stats"><span><b>${window.miseProfileStats?.recipes ?? 0}</b> Recipes</span><span><b>${window.miseProfileStats?.ingredients ?? 0}</b> Ingredients</span></div>
          <span>Member since ${escapeHtml(memberSince)}</span>
        </div>
      </section>
    </div>`;
}

function renderEditor() {
  const selected = profile.favorite_cuisines || [];
  profileView.innerHTML = `
    <div class="profile-edit-page">
      <button class="back-btn" data-profile-action="cancel">← Back to profile</button>
      <div class="page-head"><div><p class="eyebrow">YOUR DETAILS</p><h1>Edit profile</h1><p>Make this corner of Mise & Meal feel like yours.</p></div></div>
      <form class="profile-form" id="profile-form">
        <section class="panel avatar-editor">
          ${avatarMarkup('profile-avatar profile-avatar-small')}
          <label class="upload-btn">Choose profile picture<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif"></label>
          <small>JPG, PNG, WebP or GIF, up to 5 MB.</small>
        </section>
        <section class="panel profile-fields">
          <div class="form-grid">
            <label>Display name<input name="display_name" maxlength="80" required value="${escapeHtml(profile.display_name)}" placeholder="Senny"></label>
            <label>Username<div class="username-input"><span>@</span><input name="username" minlength="3" maxlength="30" pattern="[a-z0-9_]+" required value="${escapeHtml(profile.username)}" placeholder="senny"></div><small>Lowercase letters, numbers and underscores.</small></label>
          </div>
          <label>Bio <span class="optional">Optional</span><textarea name="bio" maxlength="240" rows="3" placeholder="A few words about your kitchen…">${escapeHtml(profile.bio)}</textarea></label>
          <div class="form-grid">
            <label>Diet preference<select name="diet_preference">${['Everything', 'Vegetarian', 'Vegan', 'Pescatarian'].map(value => `<option ${value === profile.diet_preference ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
            <label>Cooking level<select name="cooking_level">${['Beginner', 'Home Cook', 'Confident Cook', 'Chef Mode'].map(value => `<option ${value === profile.cooking_level ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
          </div>
          <fieldset><legend>Favorite cuisines <small>Choose up to 5</small></legend><div class="cuisine-choices">${cuisines.map(value => `<label><input type="checkbox" name="favorite_cuisines" value="${value}" ${selected.includes(value) ? 'checked' : ''}><span>${value}</span></label>`).join('')}</div></fieldset>
          <div class="profile-form-actions"><button type="button" class="secondary-btn" data-profile-action="cancel">Cancel</button><button class="primary-btn">Save changes</button></div>
          <p class="profile-form-message" id="profile-form-message" role="status"></p>
        </section>
      </form>
    </div>`;
}

async function uploadAvatar(file) {
  if (!file?.size) return profile.avatar_url;
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile pictures must be 5 MB or smaller.');
  const extension = file.name.split('.').pop().toLowerCase();
  const path = `${session.user.id}/avatar.${extension}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

document.addEventListener('click', async event => {
  const action = event.target.closest('[data-profile-action]')?.dataset.profileAction;
  if (action === 'edit') renderEditor();
  if (action === 'cancel') renderProfile();
  if (action === 'logout') {
    const button = event.target.closest('button');
    button.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) { button.disabled = false; document.querySelector('#toast').textContent = error.message; }
  }
});

document.addEventListener('change', event => {
  if (event.target.name !== 'favorite_cuisines') return;
  const checked = [...document.querySelectorAll('input[name="favorite_cuisines"]:checked')];
  if (checked.length > 5) { event.target.checked = false; document.querySelector('#profile-form-message').textContent = 'Choose up to 5 cuisines.'; }
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'profile-form') return;
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('.primary-btn');
  const message = form.querySelector('#profile-form-message');
  const data = new FormData(form);
  button.disabled = true;
  message.textContent = 'Saving…';
  try {
    const avatarUrl = await uploadAvatar(data.get('avatar'));
    const values = {
      id: session.user.id,
      display_name: data.get('display_name').trim(),
      username: data.get('username').trim().toLowerCase(),
      bio: data.get('bio').trim() || null,
      avatar_url: avatarUrl || null,
      diet_preference: data.get('diet_preference'),
      cooking_level: data.get('cooking_level'),
      favorite_cuisines: data.getAll('favorite_cuisines')
    };
    const saved = await supabase.from('profiles').upsert(values).select().single();
    if (saved.error) throw saved.error;
    profile = saved.data;
    updateHeaderAvatar();
    renderProfile();
  } catch (error) {
    button.disabled = false;
    message.textContent = error.code === '23505' ? 'That username is already taken.' : error.message;
  }
});

window.addEventListener('mise-auth-change', event => {
  session = event.detail.session;
  if (!session) { profile = null; profileView.innerHTML = ''; }
});
window.addEventListener('mise-profile-open', () => loadProfile().catch(error => {
  profileView.innerHTML = `<div class="profile-error"><h2>We couldn't load your profile.</h2><p>${escapeHtml(error.message)}</p><p>Make sure the Profile v1 SQL migration has been run in Supabase.</p></div>`;
}));

supabase?.auth.getSession().then(({ data }) => { session = data.session; });
