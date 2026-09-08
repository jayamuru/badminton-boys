import { useEffect } from 'react'
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AppProvider, useApp } from './store/AppStore'
import { ToastHost } from './components/ui'
import { TabBar } from './components/TabBar'
import { Celebration } from './components/Celebration'

import { Home } from './screens/Home'
import { Live } from './screens/Live'
import { Play } from './screens/Play'
import { CreateMatch } from './screens/CreateMatch'
import { Leaderboard } from './screens/Leaderboard'
import { Profile, PlayerProfile } from './screens/Profile'
import { MatchDetail } from './screens/MatchDetail'
import { Scoring } from './screens/Scoring'
import { Spectate } from './screens/Spectate'
import { HeadToHead } from './screens/HeadToHead'
import { Onboarding, Register } from './screens/Onboarding'
import { CloudError, CloudSplash, SignIn } from './screens/SignIn'
import {
  ClubDetail,
  FindClubs,
  FindPlayers,
  Notifications,
  TournamentScreen,
} from './screens/Discover'

/** Every route change starts at the top — the shell scrolls, not the window. */
function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    const shell = document.querySelector('.shell')
    if (shell) shell.scrollTop = 0
    window.scrollTo?.({ top: 0 })
  }, [pathname])
  return null
}

/**
 * A spectator can land straight on /watch/:id from a QR code without ever
 * having onboarded, so that route (and the two setup routes) bypass the gate.
 */
const OPEN = [/^\/watch\//, /^\/welcome/, /^\/register/]

function Gate({ children }: { children: React.ReactNode }) {
  const { state, cloud } = useApp()
  const { pathname } = useLocation()

  // Cloud mode: you can't see a shared community until you're in it.
  if (cloud.enabled) {
    if (cloud.status === 'connecting') return <CloudSplash />
    if (cloud.status === 'error') return <CloudError />
    // A shared link earns you that one match and nothing else.
    if (cloud.spectator) {
      return OPEN[0].test(pathname) ? <>{children}</> : <SignIn />
    }
    if (cloud.status === 'signed_out') return <SignIn />
    if (cloud.status === 'needs_profile') return <Register />
    return <>{children}</>
  }

  if (!state.session.onboarded && !OPEN.some((r) => r.test(pathname))) {
    return <Navigate to="/welcome" replace />
  }
  return <>{children}</>
}

function Shell() {
  return (
    <div className="shell">
      <ScrollTop />
      <Gate>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<Live />} />
          <Route path="/play" element={<Play />} />
          <Route path="/create" element={<CreateMatch />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />

          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/score/:id" element={<Scoring />} />
          <Route path="/watch/:id" element={<Spectate />} />

          <Route path="/player/:id" element={<PlayerProfile />} />
          <Route path="/h2h/:a" element={<HeadToHead />} />
          <Route path="/h2h/:a/:b" element={<HeadToHead />} />

          <Route path="/players" element={<FindPlayers />} />
          <Route path="/clubs" element={<FindClubs />} />
          <Route path="/club/:id" element={<ClubDetail />} />
          <Route path="/tournament/:id" element={<TournamentScreen />} />
          <Route path="/notifications" element={<Notifications />} />

          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/register" element={<Register />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Gate>
      <TabBar />
      <Celebration />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ToastHost>
        <HashRouter>
          <Shell />
        </HashRouter>
      </ToastHost>
    </AppProvider>
  )
}
