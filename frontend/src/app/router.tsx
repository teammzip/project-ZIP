import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { AiPage } from '@/pages/ai/AiPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { OAuthCallbackPage } from '@/pages/auth/OAuthCallbackPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { CommunityPage } from '@/pages/community/CommunityPage'
import { HomePage } from '@/pages/home/HomePage'
import { MapPage } from '@/pages/map/MapPage'
import { BudgetPage } from '@/pages/my/BudgetPage'
import { CalendarPage } from '@/pages/my/CalendarPage'
import { MyLayout } from '@/pages/my/MyLayout'
import { NotiPage } from '@/pages/my/NotiPage'
import { SettingsPage } from '@/pages/my/SettingsPage'
import { TodoPage } from '@/pages/my/TodoPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PhotoPage } from '@/pages/photo/PhotoPage'
import { StartPage } from '@/pages/start/StartPage'
import { GuestRoute, ProtectedRoute } from './guards'

/* 화면 주소 한눈에 보기. 새 화면을 만들면 여기에 한 줄 추가하세요. */
export const router = createBrowserRouter([
  // 로그인 안 한 사람만
  {
    element: <GuestRoute />,
    children: [
      { path: '/start', element: <StartPage /> },
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
        ],
      },
    ],
  },
  // 소셜 로그인 후 백엔드가 돌려보내는 주소
  { path: '/oauth/callback', element: <OAuthCallbackPage /> },

  // 로그인한 사람만
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/photo', element: <PhotoPage /> },
          { path: '/ai', element: <AiPage /> },
          { path: '/map', element: <MapPage /> },
          { path: '/community', element: <CommunityPage /> },
          {
            path: '/my',
            element: <MyLayout />,
            children: [
              { index: true, element: <Navigate to="todo" replace /> },
              { path: 'todo', element: <TodoPage /> },
              { path: 'calendar', element: <CalendarPage /> },
              { path: 'budget', element: <BudgetPage /> },
              { path: 'noti', element: <NotiPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
