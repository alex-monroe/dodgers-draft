import { supabase } from './supabase.js'

// ─── STATE ────────────────────────────────────────────────────────
let currentUser = null
let currentDraft = null
let participants = [] // Array of { id, pick_order, display_name, user_id }
let games = []        // Array of { id, game_date, opponent, ... }
let pickLog = []      // Array of { id, pick_number, participant_id, game_id }
let realtimeChannel = null
let isAdmin = false
let claimedName = null // display_name from localStorage for visitors
let pickQueue = []     // Array of game IDs queued for future picks

// ─── DOM ELEMENTS ──────────────────────────────────────────────────
const phases = {
  'no-draft': document.getElementById('phase-no-draft'),
  claim: document.getElementById('phase-claim'),
  auth: document.getElementById('phase-auth'),
  lobby: document.getElementById('phase-lobby'),
  schedule: document.getElementById('phase-schedule'),
  participants: document.getElementById('phase-participants'),
  draft: document.getElementById('phase-draft')
}

// Header
const headerUser = document.getElementById('header-user')
const userDisplayName = document.getElementById('user-display-name')
const btnLogout = document.getElementById('btn-logout')
const stepperWrap = document.getElementById('stepper-wrap')

// Auth
const authForm = document.getElementById('auth-form')
const authEmail = document.getElementById('auth-email')
const authPassword = document.getElementById('auth-password')
const authError = document.getElementById('auth-error')

// Lobby
const lobbyDraftsList = document.getElementById('lobby-drafts-list')
const btnCreateDraft = document.getElementById('btn-create-draft')
const newDraftName = document.getElementById('new-draft-name')
const newDraftYear = document.getElementById('new-draft-year')

// Schedule
const btnFetch = document.getElementById('btn-fetch')
const scheduleStatus = document.getElementById('schedule-status')
const scheduleBody = document.getElementById('schedule-body')
const gameCountEl = document.getElementById('game-count')
const btnNext1 = document.getElementById('btn-next-1')

// Participants
const participantGrid = document.getElementById('participant-grid')
const btnRandomize = document.getElementById('btn-randomize')
const btnSaveParticipants = document.getElementById('btn-save-participants')
const btnBack2 = document.getElementById('btn-back-2')
const snakePreview = document.getElementById('snake-preview')
const snakeVisual = document.getElementById('snake-visual')

// Draft Board
const gameListEl = document.getElementById('game-list')
const filterMonth = document.getElementById('filter-month')
const filterOpp = document.getElementById('filter-opp')
const pickRoundNum = document.getElementById('pick-round-num')
const pickOverallNum = document.getElementById('pick-overall-num')
const pickDrafter = document.getElementById('pick-drafter')
const pickInstruction = document.getElementById('pick-instruction')
const draftLog = document.getElementById('draft-log')
const orderList = document.getElementById('order-list')
const resultsSection = document.getElementById('results-section')
const resultsBody = document.getElementById('results-body')
const btnBack3 = document.getElementById('btn-back-3')


// ─── INITIALIZATION ────────────────────────────────────────────────
async function init() {
  // Admin login/logout buttons
  document.getElementById('btn-admin-login')?.addEventListener('click', () => showPhase('auth'))
  document.getElementById('btn-admin-login-2')?.addEventListener('click', () => showPhase('auth'))
  document.getElementById('btn-back-to-visitor')?.addEventListener('click', () => loadVisitorView())

  // Listen for auth state changes — only navigate when admin status actually changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return // handled below
    if (session) {
      if (isAdmin) return // already logged in, don't disrupt current view
      currentUser = session.user
      isAdmin = true
      headerUser.classList.remove('hidden')
      userDisplayName.textContent = currentUser.user_metadata?.display_name || currentUser.email
      btnLogout.textContent = 'Sign Out'
      showPhase('lobby')
      loadLobby()
    } else {
      currentUser = null
      isAdmin = false
      headerUser.classList.add('hidden')
      loadVisitorView()
    }
  })

  // Check initial session
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    currentUser = session.user
    isAdmin = true
    headerUser.classList.remove('hidden')
    userDisplayName.textContent = currentUser.user_metadata?.display_name || currentUser.email
    btnLogout.textContent = 'Sign Out'
    showPhase('lobby')
    loadLobby()
  } else {
    loadVisitorView()
  }
}

async function loadVisitorView() {
  // Fetch the active draft (anon RLS allows this)
  const { data: activeDrafts } = await supabase
    .from('dd_drafts')
    .select('*')
    .eq('status', 'active')
    .limit(1)

  if (!activeDrafts || activeDrafts.length === 0) {
    showPhase('no-draft')
    return
  }

  currentDraft = activeDrafts[0]

  // Load draft data
  const [gRes, pRes, picksRes] = await Promise.all([
    supabase.from('dd_draft_games').select('*').eq('draft_id', currentDraft.id).order('game_date'),
    supabase.from('dd_draft_participants').select('*').eq('draft_id', currentDraft.id).order('pick_order'),
    supabase.from('dd_draft_picks').select('*').eq('draft_id', currentDraft.id).order('pick_number')
  ])

  games = gRes.data || []
  participants = pRes.data || []
  pickLog = picksRes.data || []

  // Check localStorage for previous claim
  const saved = localStorage.getItem('dodgers-draft-claim')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.draftId === currentDraft.id && participants.some(p => p.display_name === parsed.displayName)) {
        claimedName = parsed.displayName
      }
    } catch {}
  }

  if (claimedName) {
    headerUser.classList.remove('hidden')
    userDisplayName.textContent = claimedName
    btnLogout.textContent = 'Change'
    loadQueue()
    startDraftBoard()
  } else {
    showClaimScreen()
  }
}

function showClaimScreen() {
  // Deduplicate participant names
  const uniqueNames = [...new Set(participants.map(p => p.display_name))]
  const grid = document.getElementById('claim-grid')
  grid.innerHTML = uniqueNames.map(name => `
    <div class="claim-card" onclick="claimParticipant('${name.replace(/'/g, "\\'")}')">
      <div class="claim-name">${name}</div>
    </div>
  `).join('')
  showPhase('claim')
}

window.claimParticipant = (name) => {
  claimedName = name
  localStorage.setItem('dodgers-draft-claim', JSON.stringify({
    draftId: currentDraft.id,
    displayName: name
  }))
  headerUser.classList.remove('hidden')
  userDisplayName.textContent = name
  btnLogout.textContent = 'Change'
  loadQueue()
  startDraftBoard()
}

function showPhase(phaseId) {
  Object.values(phases).forEach(el => el.classList.remove('active'))
  if (phases[phaseId]) phases[phaseId].classList.add('active')
  
  if (phaseId === 'auth' || phaseId === 'lobby' || phaseId === 'no-draft' || phaseId === 'claim') {
    stepperWrap.classList.add('hidden')
  } else {
    stepperWrap.classList.remove('hidden')
    updateStepper(phaseId)
  }
}

function updateStepper(phaseId) {
  document.querySelectorAll('.step').forEach(el => {
    el.classList.remove('active', 'done')
    const step = parseInt(el.dataset.step)
    const current = phaseId === 'schedule' ? 1 : phaseId === 'participants' ? 2 : 3
    if (step < current) el.classList.add('done')
    if (step === current) el.classList.add('active')
  })
}

// ─── AUTHENTICATION ────────────────────────────────────────────────
authForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  authError.classList.add('hidden')
  const email = authEmail.value.trim()
  const password = authPassword.value

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    authError.textContent = error.message
    authError.classList.remove('hidden')
  }
})

btnLogout.addEventListener('click', () => {
  if (isAdmin) {
    if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null }
    supabase.auth.signOut()
  } else {
    // Visitor: clear claim and go back to claim screen
    localStorage.removeItem('dodgers-draft-claim')
    claimedName = null
    headerUser.classList.add('hidden')
    if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null }
    showClaimScreen()
  }
})


// ─── LOBBY ─────────────────────────────────────────────────────────
async function loadLobby() {
  lobbyDraftsList.innerHTML = '<div class="status-msg loading">Loading drafts...</div>'
  const { data, error } = await supabase.from('dd_drafts').select(`id, name, season_year, status, owner_id, dd_users(display_name)`).order('created_at', { ascending: false })
  
  if (error) {
    lobbyDraftsList.innerHTML = `<div class="status-msg error">Error: ${error.message}</div>`
    return
  }
  
  if (data.length === 0) {
    lobbyDraftsList.innerHTML = '<div class="status-msg">No active drafts found. Create one to begin.</div>'
    return
  }

  lobbyDraftsList.innerHTML = data.map(d => `
    <div class="lobby-item">
      <div onclick="joinDraft('${d.id}')" style="cursor:pointer;flex:1">
        <div class="lobby-item-title">${d.name} (${d.season_year})</div>
        <div class="lobby-item-meta">Status: ${d.status.toUpperCase()} &middot; Host: ${d.dd_users?.display_name || 'Unknown'}</div>
      </div>
      <div class="lobby-item-actions">
        ${d.status === 'active'
          ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); toggleDraftActive('${d.id}', false)">Deactivate</button>`
          : d.status !== 'completed'
            ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); toggleDraftActive('${d.id}', true)">Activate</button>`
            : ''
        }
        <button class="btn btn-ghost btn-sm" onclick="joinDraft('${d.id}')">Enter →</button>
      </div>
    </div>
  `).join('')
}

btnCreateDraft.addEventListener('click', async () => {
  const name = newDraftName.value.trim() || 'New Draft'
  const year = parseInt(newDraftYear.value) || new Date().getFullYear()
  
  const { data, error } = await supabase.from('dd_drafts').insert([{
    name, season_year: year, owner_id: currentUser.id, status: 'setup'
  }]).select().single()

  if (error) alert('Error creating draft: ' + error.message)
  else joinDraft(data.id)
})

window.toggleDraftActive = async (draftId, activate) => {
  if (activate) {
    // Deactivate any currently active draft first
    await supabase.from('dd_drafts').update({ status: 'setup' }).eq('status', 'active')
    // Activate this one
    await supabase.from('dd_drafts').update({ status: 'active' }).eq('id', draftId)
  } else {
    await supabase.from('dd_drafts').update({ status: 'setup' }).eq('id', draftId)
  }
  loadLobby()
}

window.joinDraft = async (draftId) => {
  if (realtimeChannel) {
    await realtimeChannel.unsubscribe()
    realtimeChannel = null
  }

  const { data: d } = await supabase.from('dd_drafts').select('*').eq('id', draftId).single()
  currentDraft = d

  // Fetch games & participants & picks
  const [gRes, pRes, picksRes] = await Promise.all([
    supabase.from('dd_draft_games').select('*').eq('draft_id', draftId).order('game_date', { ascending: true }),
    supabase.from('dd_draft_participants').select('*').eq('draft_id', draftId).order('pick_order', { ascending: true }),
    supabase.from('dd_draft_picks').select('*').eq('draft_id', draftId).order('pick_number', { ascending: true })
  ])

  games = gRes.data || []
  participants = pRes.data || []
  pickLog = picksRes.data || []

  // Route to correct phase based on status
  if (currentDraft.status === 'setup' && games.length === 0) {
    showPhase('schedule')
  } else if (currentDraft.status === 'setup' && participants.length < 16) {
    renderSchedulePreview()
    initParticipantGrid()
    showPhase('participants')
  } else {
    // It's active, or setup with 16 parts ready to go
    if (currentDraft.status === 'setup') {
        await supabase.from('dd_drafts').update({ status: 'active' }).eq('id', currentDraft.id)
        currentDraft.status = 'active'
    }
    startDraftBoard()
  }
}


// ─── PHASE 1: SCHEDULE ─────────────────────────────────────────────
btnFetch.addEventListener('click', async () => {
  scheduleStatus.textContent = 'Fetching from MLB API...'
  scheduleStatus.className = 'status-msg loading'
  scheduleStatus.classList.remove('hidden')
  btnFetch.disabled = true

  try {
    const start = `${currentDraft.season_year}-02-01`
    const end = `${currentDraft.season_year}-12-31`
    const teamId = 119 // Dodgers
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${start}&endDate=${end}`
    
    const res = await fetch(url)
    const data = await res.json()
    
    // Parse games
    const newGames = []
    if (data.dates) {
      data.dates.forEach(d => {
        d.games.forEach(g => {
          if (g.gameType === 'R' && g.teams.home.team.id === teamId) {
            const dt = new Date(g.gameDate)
            newGames.push({
              draft_id: currentDraft.id,
              mlb_game_pk: g.gamePk,
              game_date: dt.toISOString().split('T')[0],
              day_of_week: dt.toLocaleDateString('en-US', { weekday: 'short' }),
              opponent: g.teams.away.team.name,
              start_time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            })
          }
        })
      })
    }

    if (newGames.length === 0) throw new Error('No regular season home games found for ' + currentDraft.season_year)

    // Save to Supabase
    const { error } = await supabase.from('dd_draft_games').insert(newGames)
    if (error) throw error

    // Fetch them back with IDs
    const gRes = await supabase.from('dd_draft_games').select('*').eq('draft_id', currentDraft.id).order('game_date')
    games = gRes.data

    scheduleStatus.textContent = `Successfully imported ${games.length} games!`
    scheduleStatus.className = 'status-msg success'
    renderSchedulePreview()
    initParticipantGrid()
    
  } catch (err) {
    scheduleStatus.textContent = err.message
    scheduleStatus.className = 'status-msg error'
  }
  btnFetch.disabled = false
})

function renderSchedulePreview() {
  gameCountEl.textContent = games.length
  scheduleBody.innerHTML = games.map((g, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${g.game_date}</td>
      <td>${g.day_of_week}</td>
      <td><strong>${g.opponent}</strong></td>
      <td>${g.start_time}</td>
    </tr>
  `).join('')
  btnNext1.classList.remove('hidden')
}

btnNext1.addEventListener('click', () => showPhase('participants'))
btnBack2.addEventListener('click', () => showPhase('schedule'))


// ─── PHASE 2: PARTICIPANTS ─────────────────────────────────────────
function initParticipantGrid() {
  participantGrid.innerHTML = ''
  for (let i = 1; i <= 16; i++) {
    const val = participants.find(p => p.pick_order === i)?.display_name || `Person ${i}`
    participantGrid.innerHTML += `
      <div class="participant-slot">
        <label>Pick ${i}</label>
        <input type="text" id="slot-${i}" value="${val}" class="slot-input" />
      </div>
    `
  }
  renderSnakePreview()
}

function getSlotNames() {
  const names = []
  for (let i = 1; i <= 16; i++) {
    names.push(document.getElementById(`slot-${i}`).value.trim() || `Person ${i}`)
  }
  return names
}

btnRandomize.addEventListener('click', () => {
  const names = getSlotNames()
  // Shuffle array (Fisher-Yates)
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  for (let i = 1; i <= 16; i++) {
    document.getElementById(`slot-${i}`).value = names[i - 1]
  }
  renderSnakePreview()
})

participantGrid.addEventListener('input', renderSnakePreview)

function renderSnakePreview() {
  const names = getSlotNames()
  snakePreview.classList.remove('hidden')
  let html = ''
  for (let round = 1; round <= 2; round++) {
    const isReverse = round % 2 === 0
    let roundOrder = isReverse ? [...names].reverse() : [...names]
    
    roundOrder.forEach(name => {
      // Find orig index for coloring
      const origIndex = names.indexOf(name)
      html += `<div class="snake-chip color-${origIndex}">${name}</div>`
    })
  }
  html += `<div class="snake-chip" style="background:var(--surface-2);color:var(--text-dim);border:none;">...</div>`
  snakeVisual.innerHTML = html
}

btnSaveParticipants.addEventListener('click', async () => {
  const names = getSlotNames()
  btnSaveParticipants.disabled = true
  
  // Wipe existing for draft, insert new
  await supabase.from('dd_draft_participants').delete().eq('draft_id', currentDraft.id)
  
  const payload = names.map((name, idx) => ({
    draft_id: currentDraft.id,
    pick_order: idx + 1,
    display_name: name
  }))

  const { error, data } = await supabase.from('dd_draft_participants').insert(payload).select()
  
  if (error) alert('Error saving participants: ' + error.message)
  else {
    participants = data.sort((a,b) => a.pick_order - b.pick_order)
    // Mark draft active
    await supabase.from('dd_drafts').update({ status: 'active' }).eq('id', currentDraft.id)
    btnSaveParticipants.textContent = 'Saved!'
    setTimeout(() => {
      startDraftBoard()
    }, 500)
  }
})


// ─── PHASE 3: DRAFT BOARD ──────────────────────────────────────────
async function startDraftBoard() {
  showPhase('draft')
  btnBack3.classList.toggle('hidden', !isAdmin)

  // Admin "Play As" selector
  const adminControls = document.getElementById('admin-controls')
  const adminPlayAs = document.getElementById('admin-play-as')
  if (isAdmin) {
    adminControls.classList.remove('hidden')
    const uniqueNames = [...new Set(participants.map(p => p.display_name))]
    adminPlayAs.innerHTML = '<option value="">None</option>' +
      uniqueNames.map(name => `<option value="${name}" ${name === claimedName ? 'selected' : ''}>${name}</option>`).join('')
    adminPlayAs.onchange = () => {
      claimedName = adminPlayAs.value || null
      loadQueue()
      updateBoard()
    }
  } else {
    adminControls.classList.add('hidden')
  }

  // Populate month filter
  const months = [...new Set(games.map(g => new Date(g.game_date).toLocaleString('default', { month: 'long' })))]
  filterMonth.innerHTML = '<option value="">All Months</option>' + months.map(m => `<option value="${m}">${m}</option>`).join('')

  filterMonth.addEventListener('change', renderGames)
  filterOpp.addEventListener('input', renderGames)
  
  // Realtime subscription
  if (!realtimeChannel) {
    realtimeChannel = supabase.channel(`public:draft_picks:draft_id=eq.${currentDraft.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dd_draft_picks', filter: `draft_id=eq.${currentDraft.id}` }, payload => {
        if (!pickLog.find(p => p.id === payload.new.id)) {
          pickLog.push(payload.new)
          pickLog.sort((a, b) => a.pick_number - b.pick_number)
          updateBoard()
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'dd_draft_picks', filter: `draft_id=eq.${currentDraft.id}` }, payload => {
        pickLog = pickLog.filter(p => p.id !== payload.old.id)
        updateBoard()
      })
      .subscribe()
  }

  updateBoard()
}

function updateBoard() {
  pruneQueue()
  renderGames()
  renderOrderList()
  renderDraftLog()
  renderPickBanner()
  renderQueue()
}

// Data Helpers
function getTotalPicksNeeded() { return games.length * 2 }
const isDraftOver = () => pickLog.length >= getTotalPicksNeeded()

function getPickerAtOverall(overallPickNum) {
  if (overallPickNum > getTotalPicksNeeded()) return null
  const numParticipants = participants.length
  if (numParticipants === 0) return null
  const round = Math.ceil(overallPickNum / numParticipants)
  const isReverse = round % 2 === 0
  const pickInRound = ((overallPickNum - 1) % numParticipants) + 1
  let slotTarget = isReverse ? (numParticipants - pickInRound + 1) : pickInRound
  return participants.find(p => p.pick_order === slotTarget)
}

function getGamePickStats(gameId) {
  return pickLog.filter(p => p.game_id === gameId).length
}

// Renders
function renderGames() {
  const term = filterOpp.value.toLowerCase()
  const mFilt = filterMonth.value

  const filtered = games.filter(g => {
    const oppMtch = g.opponent.toLowerCase().includes(term)
    const dt = new Date(g.game_date)
    const mMtch = mFilt ? dt.toLocaleString('default', { month: 'long' }) === mFilt : true
    return oppMtch && mMtch
  })

  // Check if it's this user's turn
  const currentPicker = getPickerAtOverall(pickLog.length + 1)
  const canPick = isAdmin || (currentPicker?.display_name === claimedName)

  gameListEl.innerHTML = filtered.map(g => {
    const dt = new Date(g.game_date)
    const formatDt = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
    const picksCount = getGamePickStats(g.id)
    const isQueued = pickQueue.includes(g.id)

    let stateClass = ''
    if (picksCount === 1) stateClass = 'taken-1'
    if (picksCount >= 2) stateClass = 'taken-2'
    if (!canPick && picksCount < 2) stateClass += ' not-my-turn'
    if (isQueued) stateClass += ' queued'

    return `
      <div class="game-item ${stateClass}" onclick="makePick('${g.id}')">
        <div class="game-info">
          <div class="game-date">${formatDt} &middot; ${g.start_time}</div>
          <div class="game-opp">vs ${g.opponent}</div>
        </div>
        <div class="game-slots">
          ${isQueued ? `<div class="queue-badge">Q${pickQueue.indexOf(g.id) + 1}</div>` : ''}
          <div class="slot-dot ${picksCount >= 1 ? 'filled' : ''}"></div>
          <div class="slot-dot ${picksCount >= 2 ? 'filled' : ''}"></div>
        </div>
      </div>
    `
  }).join('')
}

function renderPickBanner() {
  if (isDraftOver()) {
    pickRoundNum.parentNode.textContent = 'DRAFT COMPLETE'
    pickDrafter.textContent = 'See Final Results Below'
    if (document.getElementById('pick-instruction')) {
      document.getElementById('pick-instruction').textContent = "All tickets have been claimed!"
    }
    return
  }

  const overallPickNum = pickLog.length + 1
  const round = Math.ceil(overallPickNum / participants.length)
  const picker = getPickerAtOverall(overallPickNum)

  pickRoundNum.textContent = round
  pickOverallNum.textContent = overallPickNum
  pickDrafter.textContent = picker ? picker.display_name : 'Unknown'
  
  if (document.getElementById('pick-instruction')) {
    const isMyTurn = claimedName
      ? (picker?.display_name === claimedName)
      : false
    document.getElementById('pick-instruction').textContent =
      isMyTurn ? 'It is your turn! Select a game.' : 'Click games to add them to your queue'
  }
}

function renderOrderList() {
  if (isDraftOver()) {
    orderList.innerHTML = ''
    renderFinalResults()
    resultsSection.classList.remove('hidden')
    return
  }

  const overallPickNum = pickLog.length + 1
  
  let html = ''
  // Show next 20 picks roughly
  const maxLookahead = Math.min(overallPickNum + 20, getTotalPicksNeeded())
  
  for (let i = Math.max(1, overallPickNum - 5); i <= maxLookahead; i++) {
    const picker = getPickerAtOverall(i)
    if (!picker) continue
    
    const isPast = i < overallPickNum
    const isCurrent = i === overallPickNum
    const colorClass = `color-${picker.pick_order - 1}`
    
    let text = `${picker.display_name}`
    if (isPast) {
      const logItem = pickLog.find(p => p.pick_number === i)
      const g = games.find(g => g.id === logItem?.game_id)
      if (g) text += ` <span style="font-size:0.7em;float:right;color:var(--text-muted)">vs ${g.opponent}</span>`
    }

    html += `
      <div class="order-item ${isPast ? 'picked' : ''} ${isCurrent ? 'current' : ''}" ${isCurrent ? 'id="current-pick-ref"' : ''}>
        <div class="order-pos">${i}</div>
        <div class="order-name ${colorClass}" style="color:var(--pcolor);flex:1;">${text}</div>
      </div>
    `
  }
  orderList.innerHTML = html

  setTimeout(() => {
    const curEl = document.getElementById('current-pick-ref')
    if (curEl) curEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 100)
}

function renderDraftLog() {
  draftLog.innerHTML = pickLog.map(log => {
    const picker = participants.find(p => p.id === log.participant_id)
    const game = games.find(g => g.id === log.game_id)
    
    if (!picker || !game) return ''
    
    const dt = new Date(game.game_date)
    const formatDt = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const colorClass = `color-${picker.pick_order - 1}`

    return `
      <div class="log-entry">
        <div class="log-num">#${log.pick_number}</div>
        <div class="log-name ${colorClass}" style="color:var(--pcolor)">${picker.display_name}</div>
        <div class="log-game">vs ${game.opponent} <span style="font-size:0.8em;opacity:0.6">(${formatDt})</span></div>
        ${isAdmin ? `<button class="log-delete" onclick="event.stopPropagation(); deletePick('${log.id}')" title="Remove pick">✕</button>` : ''}
      </div>
    `
  }).reverse().join('')
}

function renderFinalResults() {
  // Group picks by participant
  const results = participants.map(p => {
    const pPicks = pickLog.filter(pl => pl.participant_id === p.id)
    const gameStrings = pPicks.map(pl => {
      const g = games.find(g => g.id === pl.game_id)
      if (!g) return 'Unknown'
      const dt = new Date(g.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `vs ${g.opponent} (${dt})`
    })
    return { name: p.display_name, games: gameStrings }
  })

  resultsBody.innerHTML = results.map(r => `
    <div class="result-person">
      <div class="result-person-name">${r.name}</div>
      <ul class="result-games">
        ${r.games.map(g => `<li>${g}</li>`).join('')}
      </ul>
    </div>
  `).join('')
}

// ─── QUEUE ──────────────────────────────────────────────────────────
function getQueueKey() {
  if (!currentDraft || !claimedName) return null
  return `dodgers-draft-queue-${currentDraft.id}-${claimedName}`
}

function loadQueue() {
  const key = getQueueKey()
  if (!key) { pickQueue = []; return }
  try {
    pickQueue = JSON.parse(localStorage.getItem(key)) || []
  } catch { pickQueue = [] }
}

function saveQueue() {
  const key = getQueueKey()
  if (!key) return
  localStorage.setItem(key, JSON.stringify(pickQueue))
}

function pruneQueue() {
  const before = pickQueue.length
  pickQueue = pickQueue.filter(gId => getGamePickStats(gId) < 2)
  if (pickQueue.length !== before) saveQueue()
}

window.toggleQueue = (gameId) => {
  const idx = pickQueue.indexOf(gameId)
  if (idx >= 0) {
    pickQueue.splice(idx, 1)
  } else {
    pickQueue.push(gameId)
  }
  saveQueue()
  updateBoard()
}

function renderQueue() {
  const queueEl = document.getElementById('queue-section')
  if (!queueEl) return

  if (!claimedName || pickQueue.length === 0) {
    queueEl.classList.add('hidden')
    return
  }

  queueEl.classList.remove('hidden')
  const queueList = document.getElementById('queue-list')

  const currentPicker = getPickerAtOverall(pickLog.length + 1)
  const isMyTurn = !isDraftOver() && (isAdmin || currentPicker?.display_name === claimedName)

  queueList.innerHTML = pickQueue.map((gId, i) => {
    const g = games.find(g => g.id === gId)
    if (!g) return ''
    const dt = new Date(g.game_date)
    const formatDt = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
    return `
      <div class="queue-item ${isMyTurn ? 'can-pick' : ''}">
        <div class="queue-pos">${i + 1}</div>
        <div class="queue-game-info" ${isMyTurn ? `onclick="makePick('${g.id}')"` : ''}>
          <div class="queue-game-date">${formatDt}</div>
          <div class="queue-game-opp">vs ${g.opponent}</div>
        </div>
        <button class="queue-remove" onclick="event.stopPropagation(); toggleQueue('${g.id}')" title="Remove from queue">&#10005;</button>
      </div>
    `
  }).join('')
}

// ─── ACTIONS ───────────────────────────────────────────────────────
let pickInFlight = false
window.makePick = async (gameId) => {
  if (pickInFlight) return
  if (isDraftOver()) return
  if (getGamePickStats(gameId) >= 2) return

  const overallPickNum = pickLog.length + 1
  const picker = getPickerAtOverall(overallPickNum)

  // Only the current picker (or admin) can make a pick — otherwise toggle queue
  if (!isAdmin && picker?.display_name !== claimedName) {
    if (claimedName) toggleQueue(gameId)
    return
  }

  pickInFlight = true
  const { data, error } = await supabase.from('dd_draft_picks').insert({
    draft_id: currentDraft.id,
    participant_id: picker.id,
    game_id: gameId,
    pick_number: overallPickNum
  }).select().single()
  pickInFlight = false

  if (error) {
    alert('Pick failed: ' + error.message)
    return
  }

  // Remove picked game from queue
  const qIdx = pickQueue.indexOf(gameId)
  if (qIdx >= 0) { pickQueue.splice(qIdx, 1); saveQueue() }

  // Add from response if realtime hasn't already
  if (!pickLog.find(p => p.id === data.id)) {
    pickLog.push(data)
    pickLog.sort((a, b) => a.pick_number - b.pick_number)
    updateBoard()
  }
}

// Delete a specific pick (admin only)
window.deletePick = async (pickId) => {
  if (!isAdmin) return
  pickLog = pickLog.filter(p => p.id !== pickId)
  updateBoard()

  const { error } = await supabase.from('dd_draft_picks').delete().eq('id', pickId)
  if (error) alert('Failed to delete pick: ' + error.message)

  // Re-number remaining picks to fill gaps
  await renumberPicks()
}

async function renumberPicks() {
  // Re-fetch picks in order and renumber them sequentially
  const { data } = await supabase.from('dd_draft_picks')
    .select('*')
    .eq('draft_id', currentDraft.id)
    .order('pick_number', { ascending: true })

  if (!data) return

  for (let i = 0; i < data.length; i++) {
    if (data[i].pick_number !== i + 1) {
      await supabase.from('dd_draft_picks')
        .update({ pick_number: i + 1 })
        .eq('id', data[i].id)
    }
  }

  // Re-fetch clean state
  const { data: fresh } = await supabase.from('dd_draft_picks')
    .select('*')
    .eq('draft_id', currentDraft.id)
    .order('pick_number', { ascending: true })
  pickLog = fresh || []
  updateBoard()
}

// Undo last pick (admin only, Cmd+Z)
document.addEventListener('keydown', async (e) => {
  if (!isAdmin) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    if (pickLog.length === 0) return
    const lastPick = pickLog.reduce((max, p) => p.pick_number > max.pick_number ? p : max, pickLog[0])
    deletePick(lastPick.id)
  }
})

document.getElementById('btn-export')?.addEventListener('click', () => alert('Copy via clipboard temporarily disabled in simple mode.'))

btnBack3.addEventListener('click', () => {
  if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null }
  if (isAdmin) {
    showPhase('lobby')
  } else {
    showClaimScreen()
  }
})

// Boot
init()
