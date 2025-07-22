import { lazy } from 'react';
import { Navigate, RouteObject, createBrowserRouter } from 'react-router';

import ErrorBoundary from '../error-boundary';
import { LazyLoad, loader, routes } from './utils';

const router: RouteObject[] = [
  {
    path: '/',
    loader: loader,
    /**
     * 可以在Root组件（自己新建），用 useLoaderData 接收 loader 返回的数据做一些操作
     * @see https://reactrouter.com/en/main/hooks/use-loader-data#useloaderdata
     */
    // element: <Root />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/home" />, // 重定向
      },
      {
        path: '/home',
        element: LazyLoad(lazy(() => import('@/views/home'))),
      },
      {
        path: '/login',
        element: LazyLoad(lazy(() => import('@/views/test/login'))),
      },
      {
        path: '/register',
        element: LazyLoad(lazy(() => import('@/views/test/register'))),
      },
      {
        path: '/404',
        element: LazyLoad(lazy(() => import('@/components/not-fount'))),
      },
      {
        path: '/learn',
        element: LazyLoad(lazy(() => import('@/views/test/learn'))),
      },
      {
        path: '/exam',
        element: LazyLoad(lazy(() => import('@/views/test/exam'))),
      },
      {
        path: '/review',
        element: LazyLoad(lazy(() => import('@/views/test/review'))),
      },
      {
        path: '/practice',
        element: LazyLoad(lazy(() => import('@/views/test/practice'))),
      },
      {
        path: '/finish',
        element: LazyLoad(lazy(() => import('@/views/test/finish'))),
      },
      {
        path: '/admin',
        element: LazyLoad(lazy(() => import('@/views/admin'))),
      },
      ...routes, // modules 路由
    ],
  },
  {
    path: '*',
    element: <Navigate to="/404" />, // 找不到页面
  },
];

export default createBrowserRouter(router);
