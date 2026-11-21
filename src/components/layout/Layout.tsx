import React from 'react'
import Sidebar  from '../Sidebar'
import Player from '../Player'
import AppVersion from '../AppVersion'

interface SidebarProps {
    children: React.ReactNode
}

export const Layout: React.FC<SidebarProps> = ({children}) => {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppVersion />
      <div className="min-h-0 flex-1"><Sidebar songs={[]}>{children}</Sidebar></div>
      <Player />
    </div>
  
  )
}
