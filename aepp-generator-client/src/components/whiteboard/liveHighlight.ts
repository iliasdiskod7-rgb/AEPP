import { useEffect, useRef } from 'react'
import type { NodeExecutionEvent } from '../../interpreter/types'
import type { ShapeItem, Point } from '../../whiteboard/model'
export function matchesExecution(item: ShapeItem, event?: NodeExecutionEvent) {
  return !!event && item.nodeId===event.nodeId && (item.executionPhase===event.phase || event.phase==='input' && item.executionPhase==='statement')
}
export function centeredPan(item: ShapeItem, width: number, height: number): Point {
  return {x:item.x+item.width/2-width/2,y:item.y+item.height/2-height/2}
}
export function useFollowNode(item: ShapeItem | undefined, width: number, height: number, pan: Point, setPan: (pan: Point)=>void, enabled=true) {
  const current=useRef(pan); current.current=pan
  useEffect(()=>{
    if(!enabled || !item) return
    const target=centeredPan(item,width,height), start=current.current
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) {setPan(target);return}
    let id=0, started: number | undefined
    const tick=(now:number)=>{
      started ??=now
      const progress=Math.min(1,(now-started)/220), eased=1-(1-progress)**3
      setPan({x:start.x+(target.x-start.x)*eased,y:start.y+(target.y-start.y)*eased})
      if(progress<1)id=requestAnimationFrame(tick)
    }
    id=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(id)
  },[item,width,height,enabled,setPan])
}
