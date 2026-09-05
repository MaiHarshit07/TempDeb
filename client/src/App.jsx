import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { createTopic, fetchCategories, fetchTopics } from './lib/api'
import './App.css'

function TopicCard({ topic }) {
  const category = topic.category?.name || 'General'
  const author = topic.author?.displayName || topic.author?.username || 'Unknown'
  const comments = topic.comments?.length || 0
  const upvotes = topic.votes?.filter((vote) => vote.type === 'UP').length || 0
  const downvotes = topic.votes?.filter((vote) => vote.type === 'DOWN').length || 0

  return (
    <article className="topic-card">
      <div className="topic-header">
        <div>
          <span className="badge">{category}</span>
          <span className="status-pill">{topic.status || 'Open'}</span>
        </div>
        <span className="meta">{new Date(topic.createdAt).toLocaleDateString()}</span>
      </div>
      <h3>{topic.title}</h3>
      <p>{topic.description}</p>
      <div className="topic-footer">
        <div className="author-box">
          <div className="avatar">{author.charAt(0)}</div>
          <span>{author}</span>
        </div>
        <div className="stats">
          <span>▲ {upvotes}</span>
          <span>▼ {downvotes}</span>
          <span>💬 {comments}</span>
        </div>
      </div>
    </article>
  )
}

function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">D</div>
        <div>
          <strong>Debate</strong>
          <small>Platform</small>
        </div>
      </div>

      <nav className="nav">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/for-you">For You</NavLink>
        <NavLink to="/explore">Explore</NavLink>
        <NavLink to="/create">Create Topic</NavLink>
        <NavLink to="/notifications">Notifications</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>

      <div className="sidebar-card">
        <p className="eyebrow">Member</p>
        <h4>{user?.displayName || 'Guest'}</h4>
        <p>{user ? `@${user.username}` : 'Sign in to join the discussion'}</p>
        {user ? (
          <button onClick={logout} className="primary-btn small">Log out</button>
        ) : (
          <NavLink to="/auth" className="primary-btn small">Join now</NavLink>
        )}
      </div>
    </aside>
  )
}

function HomePage() {
  const [topics, setTopics] = useState([])
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchTopics({ sort: 'popular' }), fetchCategories()])
      .then(([topicResult, categoryResult]) => {
        setTopics(topicResult.topics)
        setCategories(categoryResult)
      })
      .catch(() => setError('Connect PostgreSQL to load live debates.'))
  }, [])

  return (
    <div className="content-grid">
      <main className="feed">
        <div className="section-header">
          <h2>Trending</h2>
        </div>
        {error && <p className="muted">{error}</p>}
        {!error && topics.length === 0 && <p className="muted">No debates yet. Start the first one.</p>}
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} />
        ))}
      </main>

      <aside className="right-rail">
        <div className="rail-card">
          <h3>Most Discussed</h3>
          {topics.slice(0, 4).map((topic) => (
            <div key={topic.id} className="trend-item">
              <span className="dot" />
              <span>{topic.title}</span>
            </div>
          ))}
        </div>

        <div className="rail-card">
          <h3>Categories</h3>
          <div className="category-list">
            {categories.map((category) => <span key={category.id}>{category.name}</span>)}
          </div>
        </div>
      </aside>
    </div>
  )
}

function ForYouPage() {
  const [topics, setTopics] = useState([])

  useEffect(() => {
    fetchTopics({ sort: 'discussed' }).then((result) => setTopics(result.topics)).catch(() => setTopics([]))
  }, [])

  return (
    <div className="page-shell">
      <h2>For You</h2>
      <p className="muted">Recommendations based on your category affinity, recent interactions, and active discussions.</p>
      {topics.slice(0, 2).map((topic) => (
        <TopicCard key={topic.id} topic={topic} />
      ))}
    </div>
  )
}

function ExplorePage() {
  const [query, setQuery] = useState('')
  const [topics, setTopics] = useState([])

  useEffect(() => {
    fetchTopics().then((result) => setTopics(result.topics)).catch(() => setTopics([]))
  }, [])

  const visibleTopics = topics.filter((topic) =>
    `${topic.title} ${topic.description} ${topic.category?.name}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="page-shell">
      <h2>Explore</h2>
      <input className="search-box" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics and categories" />
      {visibleTopics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} />
      ))}
    </div>
  )
}

function CreateTopicPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ title: '', description: '', categoryId: '' })
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
      await createTopic(form)
      navigate('/')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to publish topic.')
    }
  }

  return (
    <div className="page-shell form-card">
      <h2>Create Topic</h2>
      <form className="stacked-form" onSubmit={submit}>
        {error && <p className="muted">{error}</p>}
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" required />
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="5" placeholder="Write your position or question..." required />
        <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          <option value="">Choose a category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button type="submit" className="primary-btn">Publish topic</button>
      </form>
    </div>
  )
}

function NotificationsPage() {
  return (
    <div className="page-shell">
      <h2>Notifications</h2>
      <div className="notification-item">
        <strong>Ava</strong> upvoted your topic.
      </div>
      <div className="notification-item">
        <strong>Milo</strong> replied to your comment.
      </div>
    </div>
  )
}

function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="page-shell profile-card">
      <div className="profile-header">
        <div className="profile-avatar">{(user?.displayName || 'D').charAt(0)}</div>
        <div>
          <h2>{user?.displayName || 'Demo User'}</h2>
          <p>@{user?.username || 'demo_user'}</p>
        </div>
      </div>
      <div className="grid-stats">
        <div><strong>24</strong><span>Topics</span></div>
        <div><strong>128</strong><span>Comments</span></div>
        <div><strong>2,450</strong><span>Tokens</span></div>
      </div>
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
    <div className="page-shell auth-shell">
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

function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Home</p>
            <h1>Debate and discuss</h1>
          </div>
          <button className="primary-btn">Start a debate</button>
        </header>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/for-you" element={<ForYouPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/create" element={<CreateTopicPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </div>
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
