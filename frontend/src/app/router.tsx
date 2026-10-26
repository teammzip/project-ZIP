import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AccountLayout } from '@/components/layout/AccountLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { HomePage } from '@/pages/home/HomePage'
import { MyLayout } from '@/pages/my/MyLayout'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { GuestRoute, ProtectedRoute } from './guards'

/** 화면 코드를 그 주소에 처음 갈 때 받아 옴 (앱을 처음 여는 속도를 빠르게 — 지도 · 관리자 · 시작 화면 코드는 들어갈 때만) */
const page =
  <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] })

/* 화면 주소 한눈에 보기. 새 화면을 만들면 여기에 한 줄 추가하세요.
 * 홈 · 화면 틀은 바로 받고, 나머지 화면은 page(() => import(…), '이름') 으로 나눠 받아요. */
export const router = createBrowserRouter([
  {
    // 첫 화면 코드를 받는 동안: 앱 배경색만 (깜빡임 없이)
    hydrateFallbackElement: <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }} />,
    children: [
      // 로그인 안 한 사람만
      {
        element: <GuestRoute />,
        children: [
          { path: '/start', lazy: page(() => import('@/pages/start/StartPage'), 'StartPage') },
          { element: <AuthLayout />, children: [{ path: '/login', lazy: page(() => import('@/pages/auth/LoginPage'), 'LoginPage') }] },
          // 회원가입 · 아이디/비밀번호 찾기: 별도 페이지
          {
            element: <AccountLayout />,
            children: [
              { path: '/signup', lazy: page(() => import('@/pages/auth/SignupPage'), 'SignupPage') },
              { path: '/find', lazy: page(() => import('@/pages/auth/FindPage'), 'FindPage') },
            ],
          },
        ],
      },
      // 소셜 로그인 후 백엔드가 돌려보내는 주소
      { path: '/oauth/callback', lazy: page(() => import('@/pages/auth/OAuthCallbackPage'), 'OAuthCallbackPage') },

      // 누구나 (로그인 전에도 볼 수 있어야 함)
      { path: '/terms', lazy: page(() => import('@/pages/legal/TermsPage'), 'TermsPage') },
      { path: '/privacy', lazy: page(() => import('@/pages/legal/PrivacyPage'), 'PrivacyPage') },

      // 로그인한 사람만
      {
        element: <ProtectedRoute />,
        children: [
          // 관리자 화면: 앱 틀 없이 전체 화면 (관리자 계정만, AdminPage 가 확인)
          { path: '/admin', lazy: page(() => import('@/pages/admin/AdminPage'), 'AdminPage') },
          // 이용 정지 안내: 정지된 계정은 앱 대신 이 화면만 (ProtectedRoute 가 보냄)
          { path: '/suspended', lazy: page(() => import('@/pages/suspended/SuspendedPage'), 'SuspendedPage') },
          // 소셜 첫 가입: 약관 동의 + 주소 입력
          { element: <AuthLayout />, children: [{ path: '/welcome', lazy: page(() => import('@/pages/auth/WelcomePage'), 'WelcomePage') }] },
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <HomePage /> },
              // 예전 '사진' 메뉴는 AI 화면(＋ 로 카메라·사진)에 합쳐짐
              { path: '/photo', element: <Navigate to="/ai" replace /> },
              { path: '/ai', lazy: page(() => import('@/pages/ai/AiPage'), 'AiPage') },
              { path: '/map', lazy: page(() => import('@/pages/map/MapPage'), 'MapPage') },
              { path: '/community', lazy: page(() => import('@/pages/community/CommunityPage'), 'CommunityPage') },
              {
                path: '/my',
                element: <MyLayout />,
                children: [
                  { index: true, element: <Navigate to="calendar" replace /> },
                  // 할 일 · 쓰레기 배출은 일정으로 합쳐짐 (예전 주소로 와도 일정으로)
                  { path: 'todo/*', element: <Navigate to="/my/calendar" replace /> },
                  { path: 'calendar', lazy: page(() => import('@/pages/my/CalendarPage'), 'CalendarPage') },
                  {
                    path: 'budget',
                    lazy: page(() => import('@/pages/my/BudgetPage'), 'BudgetPage'),
                    children: [
                      { index: true, element: <Navigate to="income" replace /> },
                      { path: 'income/*', lazy: page(() => import('@/pages/my/IncomePage'), 'IncomePage') },
                      {
                        path: 'expense',
                        lazy: page(() => import('@/pages/my/ExpensePage'), 'ExpensePage'),
                        children: [
                          { index: true, lazy: page(() => import('@/pages/my/FixedExpensePage'), 'FixedExpensePage') },
                          { path: 'spend', lazy: page(() => import('@/pages/my/SpendPage'), 'SpendPage') },
                        ],
                      },
                    ],
                  },
                  { path: 'memo', lazy: page(() => import('@/pages/my/MemoPage'), 'MemoPage') },
                  { path: 'noti', lazy: page(() => import('@/pages/my/NotiPage'), 'NotiPage') },
                  { path: 'settings', lazy: page(() => import('@/pages/my/SettingsPage'), 'SettingsPage') },
                  { path: 'settings/support/*', lazy: page(() => import('@/pages/my/SupportPage'), 'SupportPage') },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
