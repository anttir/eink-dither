import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="bg-slate-900 text-slate-100 min-h-screen">
      <Outlet />
    </div>
  )
}
