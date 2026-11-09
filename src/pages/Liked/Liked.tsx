import React, { useMemo, useState } from 'react'
import Header from '../../components/Header'
import ListItem from '../../components/ListItem'
import likeImg from '../../assets/img/liked.png'
import PageContent from '../../components/PageContent'
import SearchInput from '../../components/SearchInput'
import SearchContent from '../../components/SearchContent'
import LazyLoad from '../../components/common/LazyLoad'
import { useFetchSongs } from '../../hooks/fetchSongs'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { FaPlay } from 'react-icons/fa'
import useOnPlay from '../../hooks/useOnPlay'
import { FavPlaylists } from '../Playlists/FavPlaylists'
export const Liked = () => {
  const favoriteList = useSelector((state: RootState) => state.global.favoriteList);
  const favorites = useSelector((state: RootState) => state.global.favorites);
  const [mode, setMode] = useState<string>('songs')

  const {getLikedSongs} = useFetchSongs()
  const onPlay = useOnPlay(favoriteList, 'likedPlaylist')
  const onClickPlaylist = () => {
    if (favoriteList.length === 0) return
    onPlay(favoriteList[0].id)
  }

  if(!favorites) return null
  return (
 
    <div 
    className="
      bg-neutral-900 
      rounded-lg 
      h-full 
      w-full 
      overflow-hidden 
      overflow-y-auto
    "
  >
    <Header>
    <div className="mt-5 mb-5">
         <button
                  className={ `${mode === 'songs' ? 'bg-neutral-100/10': ''} text-white px-4 py-2 rounded mr-5` }
                   onClick={() => { setMode('songs') }}
                 >
                   Liked Songs
                 </button>
                 <button
                   className={ `${mode === 'playlists' ? 'bg-neutral-100/10': ''} text-white px-4 py-2 rounded` }
                   onClick={() => { setMode('playlists') }}
                 >
                   Liked Playlists
                 </button>
           </div>
           {mode === 'songs' && (
            <>
             <div className="mt-20">
            <div 
              className="
                flex 
                flex-col 
                md:flex-row 
                items-center 
                gap-x-5
                relative
              "
            >
           
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px'
                }}
    
                onClick={onClickPlaylist}
                >
                  {favoriteList && favoriteList?.length > 0 && (
                       <div 
                       className="
                         rounded-full 
                         flex 
                         items-center 
                         justify-center 
                         bg-green-500 
                         p-4 
                         drop-shadow-md 
                         right-5
                         group-hover:opacity-100 
                         hover:scale-110
                         cursor-pointer
                       "
                     >
                       <FaPlay className="text-black" />
                     </div>
                  )}
              
                  </div>
         
              <div className="relative h-32 w-32 lg:h-44 lg:w-44">
                <img
                  className="object-cover absolute"
           
                  src={likeImg}
                  alt="Playlist"
                />
              </div>
              <div className="flex flex-col gap-y-2 mt-4 md:mt-0">
                <p className="hidden md:block font-semibold text-sm">
                  Playlist
                </p>
                <h1 
                  className="
                    text-white 
                    text-4xl 
                    sm:text-5xl 
                    lg:text-7xl 
                    font-bold
                  "
                >
                  Liked Songs
                </h1>
              </div>
            </div>
          </div>
            <SearchContent songs={favoriteList} playlistId="likedPlaylist" />
    <LazyLoad onLoadMore={getLikedSongs}></LazyLoad>
            </>
           
           )}
          {mode === 'playlists' && (
       <FavPlaylists />
      )}
      
    </Header>
   
  </div>
  
  )
}
