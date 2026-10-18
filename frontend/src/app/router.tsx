import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AccountLayout } from '@/components/layout/AccountLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { AiPage } from '@/pages/ai/AiPage'
import { FindPage } from '@/pages/auth/FindPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { OAuthCallbackPage } from '@/pages/auth/OAuthCallbackPage'
import { WelcomePage } from '@/pages/auth/WelcomePage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { CommunityPage } from '@/pages/community/CommunityPage'
import { HomePage } from '@/pages/home/HomePage'
import { PrivacyPage } from '@/pages/legal/PrivacyPage'
import { TermsPage } from '@/pages/legal/TermsPage'
import { MapPage } from '@/pages/map/MapPage'
import { BudgetPage } from '@/pages/my/BudgetPage'
import { CalendarPage } from '@/pages/my/CalendarPage'
import { ExpensePage } from '@/pages/my/ExpensePage'
import { FixedExpensePage } from '@/pages/my/FixedExpensePage'
import { IncomePage } from '@/pages/my/IncomePage'
import { MyLayout } from '@/pages/my/MyLayout'
import { NotiPage } from '@/pages/my/NotiPage'
import { SettingsPage } from '@/pages/my/SettingsPage'
import { SpendPage } from '@/pages/my/SpendPage'
import { TodoPage } from '@/pages/my/TodoPage'
import { TrashPage } from '@/pages/my/TrashPage'
import { WeekTodoPage } from '@/pages/my/WeekTodoPage'
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
      { element: <AuthLayout />, children: [{ path: '/login', element: <LoginPage /> }] },
      // 회원가입 · 아이디/비밀번호 찾기: 팀 시안(variants/account)과 같은 별도 페이지
      {
        element: <AccountLayout />,
        children: [
          { path: '/signup', element: <SignupPage /> },
          { path: '/find', element: <FindPage /> },
        ],
      },
    ],
  },
  // 소셜 로그인 후 백엔드가 돌려보내는 주소
  { path: '/oauth/callback', element: <OAuthCallbackPage /> },

  // 누구나 (로그인 전에도 볼 수 있어야 함)
  { path: '/terms', element: <TermsPage /> },
  { path: '/privacy', element: <PrivacyPage /> },

  // 로그인한 사람만
  {
    element: <ProtectedRoute />,
    children: [
      // 소셜 첫 가입: 약관 동의 + 주소 입력
      { element: <AuthLayout />, children: [{ path: '/welcome', element: <WelcomePage /> }] },
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
              {
                path: 'todo',
                element: <TodoPage />,
                children: [
                  { index: true, element: <WeekTodoPage /> },
                  { path: 'trash', element: <TrashPage /> },
                ],
              },
              { path: 'calendar', element: <CalendarPage /> },
              {
                path: 'budget',
                element: <BudgetPage />,
                children: [
                  { index: true, element: <Navigate to="income" replace /> },
                  { path: 'income', element: <IncomePage /> },
                  {
                    path: 'expense',
                    element: <ExpensePage />,
                    children: [
                      { index: true, element: <FixedExpensePage /> },
                      { path: 'spend', element: <SpendPage /> },
                    ],
                  },
                ],
              },
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
