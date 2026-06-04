import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useCADStore } from '../store'

export function SceneSearch() {
  const query = useCADStore(s => s.sceneSearchQuery)
  const setQuery = useCADStore(s => s.setSceneSearchQuery)

  return (
    <div className="relative flex-1">
      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
      <Input
        className="h-6 text-[10px] pl-6"
        placeholder="Search..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
    </div>
  )
}
