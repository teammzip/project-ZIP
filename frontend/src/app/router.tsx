import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AccountLayout } from '@/components/layout/AccountLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { AdminPage } from '@/pages/admin/AdminPage'
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
import { MemoPage } from '@/pages/my/MemoPage'
import { MyLayout } from '@/pages/my/MyLayout'
import { NotiPage } from '@/pages/my/NotiPage'
import { SettingsPage } from '@/pages/my/SettingsPage'
import { SpendPage } from '@/pages/my/SpendPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { StartPage } from '@/pages/start/StartPage'
import { SuspendedPage } from '@/pages/suspended/SuspendedPage'
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
      // 관리자 화면: 앱 틀 없이 전체 화면 (관리자 계정만, AdminPage 가 확인)
      { path: '/admin', element: <AdminPage /> },
      // 이용 정지 안내: 정지된 계정은 앱 대신 이 화면만 (ProtectedRoute 가 보냄)
      { path: '/suspended', element: <SuspendedPage /> },
      // 소셜 첫 가입: 약관 동의 + 주소 입력
      { element: <AuthLayout />, children: [{ path: '/welcome', element: <WelcomePage /> }] },
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          // 예전 '사진' 메뉴는 AI 화면(＋ 로 카메라·사진)에 합쳐짐
          { path: '/photo', element: <Navigate to="/ai" replace /> },
          { path: '/ai', element: <AiPage /> },
          { path: '/map', element: <MapPage /> },
          { path: '/community', element: <CommunityPage /> },
          {
            path: '/my',
            element: <MyLayout />,
            children: [
              { index: true, element: <Navigate to="calendar" replace /> },
              // 할 일 · 쓰레기 배출은 일정으로 합쳐짐 (예전 주소로 와도 일정으로)
              { path: 'todo/*', element: <Navigate to="/my/calendar" replace /> },
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
              { path: 'memo', element: <MemoPage /> },
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
