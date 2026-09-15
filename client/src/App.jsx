import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { createComment, createTopic, deleteComment, fetchCategories, fetchComments, fetchForYouTopics, fetchNotifications, fetchProfile, fetchTopic, fetchTopics, markAllNotificationsRead, markNotificationRead, updateComment, voteOnComment, voteOnTopic } from './lib/api'
import './App.css'

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }

const MAX_VISUAL_DEPTH = 4

function findCommentById(comments, commentId) {
  for (const comment of comments) {
    if (comment.id === commentId) return comment
    const nestedComment = findCommentById(comment.replies || [], commentId)
    if (nestedComment) return nestedComment
  }
  return null
}

function useWorkspacePreferences() {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(sessionStorage.getItem('debate_sidebar_width') || 250))
  const [textScale, setTextScale] = useState(() => sessionStorage.getItem('debate_text_scale') || 'normal')
  const [zoom, setZoom] = useState(() => sessionStorage.getItem('debate_zoom') || '100')

  useEffect(() => {
    sessionStorage.setItem('debate_sidebar_width', String(sidebarWidth))
    sessionStorage.setItem('debate_text_scale', textScale)
    sessionStorage.setItem('debate_zoom', zoom)
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
    document.documentElement.dataset.textScale = textScale
    document.documentElement.dataset.zoom = zoom
  }, [sidebarWidth, textScale, zoom])

  return { sidebarWidth, setSidebarWidth, textScale, setTextScale, zoom, setZoom }
}

function TopicCard({ topic, onTopicChange }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [voting, setVoting] = useState(false)
  const [voteError, setVoteError] = useState('')

  const category = topic.category?.name || 'Uncategorized'
  const author = topic.author?.displayName || topic.author?.username || 'Unknown author'
  const comments = topic.comments?.length || 0
  const upvotes = topic.votes?.filter((vote) => vote.type === 'UP').length || 0
  const downvotes = topic.votes?.filter((vote) => vote.type === 'DOWN').length || 0
  const currentVote = topic.votes?.find((vote) => vote.userId === user?.id)?.type

  const handleVote = async (type) => {
    if (!user) {
      navigate('/auth')
      return
    }
    setVoting(true)
    setVoteError('')
    try {
      await voteOnTopic(topic.id, type)
      const updatedTopic = await fetchTopic(topic.id)
      onTopicChange?.(updatedTopic)
    } catch {
      setVoteError('Your vote could not be saved.')
    } finally {
      setVoting(false)
    }
  }

  return (
    <article className="topic-card reveal-card">
      <div className="topic-header">
        <div>
          <span className="badge">{category}</span>
          <span className="status-pill"><span className="live-dot" /> {topic.status || 'Unknown status'}</span>
        </div>
        <span className="meta">{new Date(topic.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </div>
      <NavLink to={`/topic/${topic.id}`}><h3>{topic.title}</h3></NavLink>
      <p>{topic.description}</p>
      <div className="topic-footer">
        <div className="author-box">
          <div className="avatar">{author.charAt(0)}</div>
          <span><strong>{author}</strong><small>@{topic.author?.username || 'unknown'}</small></span>
        </div>
        {voteError && <span className="vote-error">{voteError}</span>}
        <div className="vote-controls">
          <button type="button" disabled={voting} className={currentVote === 'UP' ? 'active-up' : ''} onClick={() => handleVote('UP')} aria-label="Upvote topic">▲ {upvotes}</button>
          <button type="button" disabled={voting} className={currentVote === 'DOWN' ? 'active-down' : ''} onClick={() => handleVote('DOWN')} aria-label="Downvote topic">▼ {downvotes}</button>
          <span>◌ {comments}</span>
        </div>
      </div>
    </article>
  )
}

function Sidebar({ user, logout }) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    const loadUnreadCount = () => fetchNotifications().then((notifications) => setUnreadCount(notifications.filter((notification) => !notification.isRead).length)).catch(() => setUnreadCount(0))
    loadUnreadCount()
    const interval = window.setInterval(loadUnreadCount, 10000)
    return () => window.clearInterval(interval)
  }, [user])

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">↗</div>
        <div>
          <strong>counterpoint</strong>
          <small>think better together</small>
        </div>
      </div>

      <nav className="nav">
        <NavLink to="/"><Icon>⌂</Icon> Home</NavLink>
        <NavLink to="/for-you"><Icon>✦</Icon> For You</NavLink>
        <NavLink to="/explore"><Icon>⌕</Icon> Explore</NavLink>
        <NavLink to="/create"><Icon>＋</Icon> New debate</NavLink>
        <NavLink to="/notifications"><Icon>♧</Icon> Notifications {user && unreadCount > 0 && <span className="nav-count">{unreadCount}</span>}</NavLink>
        <NavLink to="/profile"><Icon>◉</Icon> Profile</NavLink>
      </nav>

      <div className="sidebar-card">
        <p className="eyebrow">YOUR PRESENCE</p>
        <h4>{user?.displayName || 'Guest'}</h4>
        <p>{user ? `@${user.username}` : 'Join the room to vote and reply.'}</p>
        {user ? (
          <button onClick={logout} className="primary-btn small">Log out</button>
        ) : (
          <NavLink to="/auth" className="primary-btn small">Join now</NavLink>
        )}
      </div>
    </aside>
  )
}

function MostDiscussedPanel() {
  const [topics, setTopics] = useState([])
  const location = useLocation()

  useEffect(() => {
    let active = true
    const loadTopics = () => fetchTopics({ sort: 'discussed', limit: 5 })
      .then((result) => { if (active) setTopics(result.topics) })
      .catch(() => { if (active) setTopics([]) })
    loadTopics()
    const interval = window.setInterval(loadTopics, 5000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])

  return (
    <aside className={`right-panel${location.pathname === '/create' ? ' create-right-panel' : ''}`}>
      {location.pathname === '/create' && <>
        <section className="room-guide-panel"><p className="eyebrow">ROOM GUIDE</p><h3>Good faith is a feature.</h3><p>Lead with your strongest interpretation of the other side. Cite your sources. Leave the room more informed than you found it.</p><div className="guide-line"><span>01</span> Steelman before rebutting</div><div className="guide-line"><span>02</span> Vote on the argument</div><div className="guide-line"><span>03</span> Stay open to revision</div></section>
        <section className="motion-preview-panel"><div className="preview-heading"><span>MOTION CARD PREVIEW</span><b>Live</b></div><p>Explore a proposition, test the evidence, and make your strongest case.</p><small>Live debate arena</small></section>
      </>}
      {location.pathname === '/explore' && <section className="room-guide-panel"><p className="eyebrow">EXPLORE THE FIELD</p><h3>Follow the tension.</h3><p>Search the live debate archive and open the question that makes you think twice.</p><div className="guide-line"><span>01</span> Search by topic or category</div><div className="guide-line"><span>02</span> Compare both sides</div></section>}
      {location.pathname === '/for-you' && <section className="room-guide-panel"><p className="eyebrow">YOUR SIGNAL</p><h3>Questions shaped by you.</h3><p>Your personalized feed is computed from your debate activity, category affinity, and recent engagement.</p></section>}
      {location.pathname.startsWith('/topic/') && <section className="room-guide-panel"><p className="eyebrow">DEBATE ROOM</p><h3>Good faith is a feature.</h3><p>Read the strongest version of the other side before you rebut. Vote on arguments, not people.</p><div className="guide-line"><span>01</span> Steelman before rebutting</div><div className="guide-line"><span>02</span> Stay open to revision</div></section>}
      <div className="right-panel-card">
        <div className="rail-heading"><h3>Top 5 most discussed</h3><span>↗</span></div>
        {topics.length === 0 && <p className="muted">No discussions yet.</p>}
        {topics.map((topic, index) => (
          <NavLink key={topic.id} to={`/topic/${topic.id}`} className="trend-item">
            <span className="rank">0{index + 1}</span>
            <span>{topic.title}</span>
          </NavLink>
        ))}
      </div>
      {location.pathname === '/profile' && <section className="right-honesty-card">
        <span className="eyebrow">HONESTY &amp; PERSUASION</span>
        <div className="right-honesty-score"><strong>Dialogue quality</strong><span>Building</span></div>
        <div className="honesty-track"><span /></div>
        <p>Evidence, humility, and meaningful counterpoints shape this profile metric as activity grows.</p>
      </section>}
    </aside>
  )
}

function HomePage() {
  const [topics, setTopics] = useState([])
  const [error, setError] = useState('')
  const [timeframe, setTimeframe] = useState('week')
  const [sort, setSort] = useState('newest')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    fetchCategories().then((result) => setCategories(result.categories || [])).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    let active = true
    const loadTopics = () => fetchTopics({ sort, limit: 20, ...(category ? { category } : {}) })
      .then((topicResult) => {
        if (!active) return
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        setTopics(timeframe === 'week'
          ? topicResult.topics.filter((topic) => new Date(topic.createdAt).getTime() >= weekAgo)
          : topicResult.topics)
      })
      .catch(() => { if (active) setError('Unable to load live debates. Check the API connection.') })
    loadTopics()
    const interval = window.setInterval(loadTopics, 5000)
    return () => { active = false; window.clearInterval(interval) }
  }, [timeframe, sort, category])

  const updateTopic = (updatedTopic) => setTopics((currentTopics) => currentTopics.map((topic) => topic.id === updatedTopic.id ? updatedTopic : topic))

  return (
    <div className="content-grid page-enter">
      <main className="feed">
        <div className="section-header">
          <div><p className="eyebrow">THE PUBLIC SQUARE</p><h2>Find your edge.</h2></div>
          <div className="home-filters" aria-label="Debate filters">
            <select className="filter-btn" value={timeframe} onChange={(event) => setTimeframe(event.target.value)} aria-label="Timeframe">
              <option value="week">This week</option>
              <option value="all">All time</option>
            </select>
            <select className="filter-btn" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort debates">
              <option value="newest">Newest</option>
              <option value="popular">Most voted</option>
              <option value="discussed">Most discussed</option>
            </select>
            <select className="filter-btn" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="notice">{error}</p>}
        {topics.length === 0 && <p className="muted">No debates yet. Start the first one.</p>}
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} onTopicChange={updateTopic} />
        ))}
      </main>

    </div>
  )
}

function ForYouPage() {
  const { user, loading: authLoading } = useAuth()
  const [topics, setTopics] = useState([])
  const [loadedUserId, setLoadedUserId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading || !user) return
    let active = true
    const loadForYou = () => fetchForYouTopics()
      .then((result) => { if (active) setTopics(result.topics || []) })
      .catch(() => { if (active) setError('We could not load your recommendations right now.') })
      .finally(() => { if (active) setLoadedUserId(user.id) })
    loadForYou()
    const interval = window.setInterval(loadForYou, 5000)
    return () => { active = false; window.clearInterval(interval) }
  }, [authLoading, user])

  const updateTopic = (updatedTopic) => setTopics((currentTopics) => currentTopics.map((topic) => topic.id === updatedTopic.id ? updatedTopic : topic))

  const loading = Boolean(user) && loadedUserId !== user.id

  return (
    <div className="page-shell page-enter">
      <p className="eyebrow">CURATED FOR YOU</p><h2>Questions worth your attention.</h2>
      <p className="muted">Recommendations based on your category affinity, recent interactions, and active discussions.</p>
      {!authLoading && !user && <p className="notice">Sign in to unlock a feed shaped by your interests and arguments.</p>}
      {error && <p className="notice">{error}</p>}
      {loading && user && <p className="muted">Finding your next good argument...</p>}
      {!loading && !error && user && topics.length === 0 && <p className="muted">No recommendations yet. Explore a few debates and your personal feed will take shape.</p>}
      {!loading && topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} onTopicChange={updateTopic} />
      ))}
    </div>
  )
}

function ExplorePage() {
  const [query, setQuery] = useState('')
  const [topics, setTopics] = useState([])

  useEffect(() => {
    let active = true
    const loadTopics = () => fetchTopics()
      .then((result) => { if (active) setTopics(result.topics) })
      .catch(() => { if (active) setTopics([]) })
    loadTopics()
    const interval = window.setInterval(loadTopics, 5000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])

  const updateTopic = (updatedTopic) => setTopics((currentTopics) => currentTopics.map((topic) => topic.id === updatedTopic.id ? updatedTopic : topic))

  const visibleTopics = topics.filter((topic) =>
    `${topic.title} ${topic.description} ${topic.category?.name}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="page-shell page-enter">
      <p className="eyebrow">EXPLORE THE FIELD</p><h2>Follow the tension.</h2>
      <label className="search-wrap"><Icon>⌕</Icon><input className="search-box" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics, categories, or people" /></label>
      {visibleTopics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} onTopicChange={updateTopic} />
      ))}
    </div>
  )
}

function CreateTopicPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ title: '', description: '', categoryId: '', stance: 'FOR', format: 'dual', opening: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (!user) {
      navigate('/auth')
      return
    }
    try {
      const description = [form.description.trim(), form.opening.trim() ? `Opening position (${form.stance}):\n${form.opening.trim()}` : ''].filter(Boolean).join('\n\n')
      await createTopic({ title: form.title, description, categoryId: form.categoryId })
      navigate('/')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to publish topic.')
    }
  }

  return (
    <div className="create-page page-enter">
      <div className="create-kicker"><span>THE ARENA · NEW PROPOSITION</span><b>/</b><small>DRAFT MODE</small></div>
      <h2>Frame a Motion.<br />Make your case.</h2>
      <p className="create-intro">A good debate begins with a falsifiable, clear premise. Formulate your argument with rigor and invite the room to stress-test your claims.</p>
      <form className="stacked-form" onSubmit={submit}>
        {error && <p className="notice">{error}</p>}
        <section className="create-step"><div className="step-label"><span>1</span><label htmlFor="motion-title">THE PROPOSITION (MOTION) <b>*</b></label><small>{form.title.length} / 140</small></div><input id="motion-title" maxLength="140" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Should AI development be paused until verifiable safety standards exist?" required /><div className="editorial-tip">ⓘ <span><strong>Editorial Rule:</strong> Phrase as a direct proposition or dilemma rather than an ambiguous topic.</span></div></section>
        <section className="create-step"><div className="step-label"><span>2</span><label htmlFor="motion-context">CONTEXT &amp; OPERATIONAL DEFINITIONS</label><small>Markdown enabled</small></div><textarea id="motion-context" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="5" placeholder="Provide background context and clarify key phrases so opponents debate the reality, not semantics..." required /></section>
        <section className="create-step configuration-step"><div className="step-label"><span>3</span><label>CATEGORIZATION, FORMAT &amp; INITIAL STANCE</label></div><div className="create-field"><span className="field-label">CATEGORY DOMAIN</span><div className="category-picker">{categories.map((category) => <button type="button" key={category.id} className={form.categoryId === category.id ? 'selected' : ''} onClick={() => setForm({ ...form, categoryId: category.id })}>{category.name}</button>)}</div></div><div className="create-field"><span className="field-label">DEBATE ARENA STRUCTURE</span><div className="format-grid">{[['dual', 'Dual Arena', 'Two columns (For vs Against).'], ['roundtable', 'Open Roundtable', 'Multi-perspective spectrum.'], ['clash', '1-on-1 Clash', 'Timed duel between two debaters.']].map(([value, title, text]) => <button type="button" key={value} className={form.format === value ? 'selected' : ''} onClick={() => setForm({ ...form, format: value })}><strong>{title}</strong><small>{text}</small></button>)}</div></div><div className="create-field"><span className="field-label">YOUR INITIAL STANCE</span><div className="stance-picker"><button type="button" className={form.stance === 'FOR' ? 'selected' : ''} onClick={() => setForm({ ...form, stance: 'FOR' })}>● I argue FOR</button><button type="button" className={form.stance === 'AGAINST' ? 'selected against' : ''} onClick={() => setForm({ ...form, stance: 'AGAINST' })}>● I argue AGAINST</button></div></div></section>
        <section className="create-step"><div className="step-label"><span>4</span><label htmlFor="opening-salvo">OPENING SALVO (YOUR FIRST ARGUMENT)</label><small>Position: {form.stance}</small></div><p className="step-help">Present your strongest premise first. Good-faith debate relies on steel-manning opposing views before concluding.</p><textarea id="opening-salvo" value={form.opening} onChange={(event) => setForm({ ...form, opening: event.target.value })} rows="4" placeholder="State your premier logical pillar for this motion..." /></section>
        <div className="create-actions"><button type="button" className="secondary-btn">Save draft</button><button type="submit" className="primary-btn">Publish Debate to Arena ↗</button></div>
      </form>
    </div>
  )
}

function NotificationsPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading || !user) return
    fetchNotifications().then(setNotifications).catch(() => setError('Unable to load notifications.'))
  }, [authLoading, user])

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id)
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, isRead: true } : item))
      } catch {
        setError('Unable to update notification.')
        return
      }
    }
    if (notification.topicId) navigate(`/topic/${notification.topicId}`)
  }
  const markAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })))
    } catch {
      setError('Unable to update notifications.')
    }
  }
  const unreadCount = notifications.filter((notification) => !notification.isRead).length

  return (
    <div className="page-shell page-enter">
      <div className="notifications-heading"><div><p className="eyebrow">YOUR SIGNALS</p><h2>Stay in the conversation.</h2></div>{unreadCount > 0 && <button type="button" className="mark-all-read" onClick={markAllRead}>Mark all read</button>}</div>
      {!authLoading && !user && <p className="notice">Sign in to view your notifications.</p>}
      {error && <p className="notice">{error}</p>}
      {user && !error && notifications.length === 0 && <p className="muted">You have no notifications yet.</p>}
      {notifications.map((notification) => <button type="button" className={`notification-item${notification.isRead ? '' : ' unread'}`} key={notification.id} onClick={() => openNotification(notification)}><strong>{notification.actor?.displayName || 'Someone'}</strong> {notification.type.toLowerCase().replaceAll('_', ' ')} {notification.topic?.title ? `on “${notification.topic.title}”` : ''}<small>{new Date(notification.createdAt).toLocaleString()}</small></button>)}
    </div>
  )
}

function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const { sidebarWidth, setSidebarWidth, textScale, setTextScale, zoom, setZoom } = useWorkspacePreferences()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('debates')

  useEffect(() => {
    if (authLoading || !user) return
    fetchProfile(user.username).then(setProfile).catch(() => setError('Unable to load your profile.'))
  }, [authLoading, user])

  return (
    <div className="profile-page page-enter">
      {!authLoading && !user && <section className="profile-empty"><p className="eyebrow">YOUR PROFILE</p><h2>Sign in to view your profile.</h2><NavLink to="/auth" className="primary-btn">Sign in ↗</NavLink></section>}
      {error && <p className="notice">{error}</p>}
      {profile && <>
        <section className="profile-hero-card">
          <div className="profile-hero-top">
            <div className="profile-identity">
              <div className="profile-avatar">{profile.displayName.charAt(0).toUpperCase()}</div>
              <div>
                <div className="profile-name-row"><h2>{profile.displayName}</h2><span className="profile-role">{profile.role}</span></div>
                <p className="profile-handle">@{profile.username} <span>• Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span></p>
                {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              </div>
            </div>
          </div>
          <div className="profile-metrics">
            <div><strong>{profile.topics.length}</strong><span>Topics</span></div>
            <div><strong>{profile.comments.length}</strong><span>Comments</span></div>
            <div><strong>{profile.activityTokens}</strong><span>Tokens</span></div>
            </div>
            <div className="honesty-card">
              <span className="eyebrow">HONESTY &amp; PERSUASION</span>
              <div className="honesty-title-row"><strong>Dialogue quality</strong><span className="honesty-neutral">Building from live activity</span></div>
              <div className="honesty-track"><span /></div>
              <p>Scores appear after enough debate activity is available to measure evidence and meaningful counterpoints.</p>
            </div>
        </section>
          <div className="profile-tabs" role="tablist"><button className={activeTab === 'debates' ? 'active' : ''} type="button" onClick={() => setActiveTab('debates')}>Active debates ({profile.topics.length})</button><button className={activeTab === 'persuasion' ? 'active' : ''} type="button" onClick={() => setActiveTab('persuasion')}>Persuasion log</button><button className={activeTab === 'bookmarks' ? 'active' : ''} type="button" onClick={() => setActiveTab('bookmarks')}>Bookmarks</button><button className={activeTab === 'settings' ? 'active' : ''} type="button" onClick={() => setActiveTab('settings')}>Settings</button></div>
          {activeTab === 'settings' && <section className="profile-settings">
            <div className="settings-heading"><p className="eyebrow">WORKSPACE SETTINGS</p><h3>Make the room yours.</h3></div>
            <label className="settings-control" htmlFor="profile-sidebar-width"><span><strong>Sidebar width</strong><small>Adjust the fixed left navigation.</small></span><output>{sidebarWidth}px</output></label>
            <input id="profile-sidebar-width" type="range" min="210" max="360" step="5" value={sidebarWidth} onChange={(event) => setSidebarWidth(Number(event.target.value))} />
            <div className="settings-control"><span><strong>Text size</strong><small>Choose a comfortable reading scale.</small></span><div className="text-scale-options">{['small', 'normal', 'large'].map((size) => <button key={size} type="button" className={textScale === size ? 'selected' : ''} onClick={() => setTextScale(size)}>{size === 'small' ? 'A' : size === 'normal' ? 'A+' : 'A++'}</button>)}</div></div>
            <div className="settings-control"><span><strong>Interface zoom</strong><small>Scale the whole workspace.</small></span><div className="zoom-options">{['90', '100', '110'].map((value) => <button key={value} type="button" className={zoom === value ? 'selected' : ''} onClick={() => setZoom(value)}>{value}%</button>)}</div></div>
          </section>}
          {activeTab === 'debates' && <section className="profile-debates">
          {profile.topics.length === 0 && <p className="muted">You have not opened a debate yet.</p>}
          {profile.topics.map((topic) => <article className="profile-debate-card" key={topic.id}>
            <div className="profile-debate-meta"><span className="profile-topic-label">{topic.category?.name || 'Uncategorized'}</span><span className="profile-status">{topic.status}</span><span className="profile-date">{new Date(topic.createdAt).toLocaleDateString()}</span></div>
            <NavLink to={`/topic/${topic.id}`}><h3>{topic.title}</h3></NavLink>
            <p>{topic.description}</p>
            <div className="profile-debate-footer"><span>◌ {profile.comments.filter((comment) => comment.topicId === topic.id).length} replies</span><NavLink to={`/topic/${topic.id}`}>View debate ↗</NavLink></div>
          </article>)}
        </section>}
        {activeTab !== 'debates' && activeTab !== 'settings' && <section className="profile-tab-empty"><p className="muted">This section will fill with your live activity as you participate in more debates.</p></section>}
      </>}
    </div>
  )
}

function AuthPage() {
  const { login, register, error } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ emailOrUsername: '', username: '', displayName: '', email: '', password: '', confirmPassword: '' })

  const submit = async (event) => {
    event.preventDefault()
    if (mode === 'login') {
      await login({ emailOrUsername: form.emailOrUsername, password: form.password })
    } else {
      await register(form)
    }
  }

  return (
    <div className="page-shell auth-shell page-enter">
      <div className="form-card">
        <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
        <form className="stacked-form" onSubmit={submit}>
          {error && <p className="muted">{error}</p>}
          {mode === 'login' ? <input value={form.emailOrUsername} onChange={(event) => setForm({ ...form, emailOrUsername: event.target.value })} placeholder="Email or username" required /> : <>
            <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Username" required />
            <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Display name" required />
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" required />
          </>}
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" required />
          {mode === 'register' && <input type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} placeholder="Confirm password" required />}
          <button type="submit" className="primary-btn">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button type="button" className="text-btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
        </button>
      </div>
    </div>
  )
}

function CommentItem({ comment, topicId, user, onCreated, depth = 0 }) {
  const navigate = useNavigate()
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [voting, setVoting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(comment.content)
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')

  const submitReply = async (event) => {
    event.preventDefault()
    if (!user) {
      navigate('/auth')
      return
    }
    if (!reply.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await createComment(topicId, { content: reply, parentId: comment.id })
      setReply('')
      onCreated()
    } catch {
      setError('Reply could not be posted.')
    } finally {
      setSubmitting(false)
    }
  }

  const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH)
  const continueThread = () => navigate(`?commentId=${comment.id}`)
  const votes = comment.votes || []
  const currentVote = votes.find((vote) => vote.userId === user?.id)?.type
  const upvotes = votes.filter((vote) => vote.type === 'UP').length
  const downvotes = votes.filter((vote) => vote.type === 'DOWN').length
  const handleVote = async (type) => {
    if (!user) {
      navigate('/auth')
      return
    }
    setVoting(true)
    try {
      await voteOnComment(comment.id, type, topicId)
      onCreated()
    } finally {
      setVoting(false)
    }
  }
  const saveEdit = async (event) => {
    event.preventDefault()
    if (!editedContent.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await updateComment(comment.id, editedContent.trim(), topicId)
      setEditing(false)
      onCreated()
    } catch {
      setError('Comment could not be updated.')
    } finally {
      setSubmitting(false)
    }
  }
  const removeComment = async () => {
    if (!window.confirm('Delete this comment?')) return
    setSubmitting(true)
    setError('')
    try {
      await deleteComment(comment.id, topicId)
      onCreated()
    } catch {
      setError('Comment could not be deleted.')
    } finally {
      setSubmitting(false)
    }
  }
  const isAuthor = user?.id === comment.author?.id

  return <>
    <article className={`comment-item comment-depth-${visualDepth}`}>
      <div className="comment-header"><div className="comment-meta"><strong>{comment.author?.displayName || 'Unknown author'}</strong><span>@{comment.author?.username || 'unknown'}</span><time>{new Date(comment.createdAt).toLocaleDateString()}</time></div><div className="comment-card-actions"><div className="comment-votes"><button type="button" className={currentVote === 'UP' ? 'selected' : ''} disabled={voting} onClick={() => handleVote('UP')}>▲ {upvotes}</button><button type="button" className={currentVote === 'DOWN' ? 'selected down' : ''} disabled={voting} onClick={() => handleVote('DOWN')}>▼ {downvotes}</button></div>{isAuthor && <div className="comment-menu"><button type="button" className="comment-menu-trigger" aria-label="Comment options" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>⋯</button>{menuOpen && <div className="comment-menu-list"><button type="button" onClick={() => { setEditing(true); setMenuOpen(false) }}>Edit</button><button type="button" className="delete-comment" onClick={removeComment}>Delete</button></div>}</div>}</div></div>
      {editing ? <form className="comment-edit-form" onSubmit={saveEdit}><textarea value={editedContent} onChange={(event) => setEditedContent(event.target.value)} rows="3" /><div><button type="button" onClick={() => { setEditing(false); setEditedContent(comment.content) }}>Cancel</button><button type="submit" disabled={submitting}>Save</button></div></form> : <p>{comment.content}</p>}
      {user && <form className="reply-form" onSubmit={submitReply}><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to this argument..." /><button type="submit" disabled={submitting}>{submitting ? '...' : 'Reply'}</button></form>}
      {error && <small className="comment-error">{error}</small>}
    </article>
    {comment.replies?.length > 0 && (depth >= MAX_VISUAL_DEPTH
      ? <button type="button" className={`continue-thread comment-depth-${visualDepth}`} onClick={continueThread}>Continue this thread →</button>
      : <div className="comment-replies">{comment.replies.map((child) => <CommentItem key={child.id} comment={child} topicId={topicId} user={user} onCreated={onCreated} depth={depth + 1} />)}</div>)}
  </>
}

function CommentColumn({ topicId, stance, comments, user, onRefresh }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)

  const submitComment = async (event) => {
    event.preventDefault()
    if (!user) {
      navigate('/auth')
      return
    }
    if (!content.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await createComment(topicId, { content, stance })
      setContent('')
      onRefresh()
    } catch {
      setError('Argument could not be posted.')
    } finally {
      setSubmitting(false)
    }
  }

  const rootComment = findCommentById(comments, searchParams.get('commentId'))
  const visibleComments = rootComment ? [rootComment] : comments
  const displayedComments = showAll ? visibleComments : visibleComments.slice(0, 3)

  return <section className={`comment-column ${stance.toLowerCase()}`}>
    <div className="comment-column-heading"><div><span className="stance-dot" /><h3>{stance === 'FOR' ? 'For' : 'Against'}</h3></div><span>{comments.length} arguments</span></div>
    {user ? <form className="comment-composer" onSubmit={submitComment}><textarea value={content} onChange={(event) => setContent(event.target.value)} rows="3" placeholder={`Make the strongest ${stance === 'FOR' ? 'case for' : 'case against'} this motion...`} /><button type="submit" disabled={submitting}>{submitting ? 'Posting...' : 'Post argument'}</button></form> : <button type="button" className="comment-login" onClick={() => navigate('/auth')}>Sign in to add an argument</button>}
    {error && <p className="comment-error">{error}</p>}
    <div className="comment-list">{displayedComments.length ? displayedComments.map((comment) => <CommentItem key={comment.id} comment={comment} topicId={topicId} user={user} onCreated={onRefresh} />) : <p className="muted">No {stance.toLowerCase()} arguments yet.</p>}</div>
    {!showAll && visibleComments.length > 3 && <button type="button" className="show-more-comments" onClick={() => setShowAll(true)}>Show more ({visibleComments.length - 3})</button>}
  </section>
}

function TopicPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [topic, setTopic] = useState(null)
  const [error, setError] = useState('')
  const [voting, setVoting] = useState(false)
  const [forComments, setForComments] = useState([])
  const [againstComments, setAgainstComments] = useState([])
  const [commentsError, setCommentsError] = useState('')
  const [searchParams] = useSearchParams()
  const rootCommentId = searchParams.get('commentId')
  useEffect(() => {
    let active = true
    const loadTopic = () => fetchTopic(id).then((nextTopic) => { if (active) setTopic(nextTopic) }).catch(() => { if (active) setError('Unable to load this live debate.') })
    loadTopic()
    const interval = window.setInterval(loadTopic, 3000)
    return () => { active = false; window.clearInterval(interval) }
  }, [id])
  const loadComments = useCallback(() => Promise.all([fetchComments(id, 'FOR', rootCommentId), fetchComments(id, 'AGAINST', rootCommentId)])
    .then(([nextFor, nextAgainst]) => { setForComments(nextFor); setAgainstComments(nextAgainst); setCommentsError('') })
    .catch(() => setCommentsError('Unable to load arguments right now.')), [id, rootCommentId])

  useEffect(() => {
    loadComments()
    const interval = window.setInterval(loadComments, 4000)
    return () => window.clearInterval(interval)
  }, [loadComments])
  if (error) return <p className="notice">{error}</p>
  if (!topic) return <p className="muted">Opening the room...</p>
  const votes = topic.votes || []
  const agree = votes.filter((vote) => vote.type === 'UP').length
  const oppose = votes.filter((vote) => vote.type === 'DOWN').length
  const total = agree + oppose
  const agreePercent = total ? Math.round((agree / total) * 100) : 0
  const currentVote = votes.find((vote) => vote.userId === user?.id)?.type
  const handleVote = async (type) => {
    if (!user) {
      navigate('/auth')
      return
    }
    setVoting(true)
    try {
      await voteOnTopic(topic.id, type)
      setTopic(await fetchTopic(topic.id))
    } finally {
      setVoting(false)
    }
  }
  return <div className="debate-room page-enter">
    <NavLink to="/" className="back-link">← Back to the square</NavLink>
    <section className="motion-hero">
      <div><span className="badge">{topic.category?.name || 'Uncategorized'}</span><span className="status-pill"><span className="live-dot" /> {topic.status || 'Unknown status'}</span><h2>{topic.title}</h2><p>{topic.description}</p><div className="author-box"><div className="avatar">{(topic.author?.displayName || 'U').charAt(0)}</div><span><strong>{topic.author?.displayName || 'Unknown author'}</strong><small>opened this motion</small></span></div></div>
      <div className="vote-panel"><div className="panel-label">LIVE DELIBERATION <span>◉ {votes.length} votes</span></div><div className="vote-numbers"><strong>{agreePercent}% <small>IN FAVOR</small></strong><strong>{100 - agreePercent}% <small>OPPOSED</small></strong></div><div className="vote-bar"><span style={{ width: `${agreePercent}%` }} /></div><div className="lean-indicator">{topic.insufficientVotes ? 'Not enough votes to establish a lean' : `Leaning ${topic.leanPercent >= 50 ? 'FOR' : 'AGAINST'} — ${topic.leanPercent}%`} {topic.trend !== 'stable' && topic.trend !== 'insufficient_data' && <span>↗ Trending toward {topic.trend === 'toward_for' ? 'for' : 'against'}</span>}</div><div className="vote-actions"><button disabled={voting || authLoading} className={currentVote === 'UP' ? 'selected' : ''} onClick={() => handleVote('UP')}>▲ I agree</button><button disabled={voting || authLoading} className={currentVote === 'DOWN' ? 'selected oppose' : ''} onClick={() => handleVote('DOWN')}>▼ I disagree</button></div>{!user && <small className="vote-login-note">Sign in to vote.</small>}</div>
    </section>
    <div className="room-grid"><section className="arena-section"><div className="section-header"><div><p className="eyebrow">THE ARENA</p><h2>Make the strongest case.</h2></div><span className="muted">{forComments.length + againstComments.length} arguments</span></div>{commentsError && <p className="notice">{commentsError}</p>}<div className="comment-columns"><CommentColumn topicId={topic.id} stance="FOR" comments={forComments} user={user} onRefresh={loadComments} /><CommentColumn topicId={topic.id} stance="AGAINST" comments={againstComments} user={user} onRefresh={loadComments} /></div></section></div>
  </div>
}

function AppShell() {
  useWorkspacePreferences()
  const { user, logout } = useAuth()

  useEffect(() => {
    fetchTopics({ sort: 'newest', limit: 20 }).catch(() => {})
    fetchCategories().catch(() => {})
  }, [])

  return (
    <div className="app-shell">
      <Sidebar user={user} logout={logout} />
      <div className="main-panel">
        <header className="topbar">
          <div><p className="eyebrow">MONDAY, SEPTEMBER 14</p><h1>Good arguments change us.</h1></div>
          <NavLink to="/create" className="primary-btn top-action">＋ <span>Start a debate</span></NavLink>
        </header>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/for-you" element={<ForYouPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/create" element={<CreateTopicPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/topic/:id" element={<TopicPage />} />
        </Routes>
      </div>
      <MostDiscussedPanel />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
