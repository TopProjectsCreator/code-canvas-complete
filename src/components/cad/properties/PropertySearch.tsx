import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useCADStore } from '../store'

export function PropertySearch() {
  const query = useCADStore(s => s.propertySearchQuery)
  const setQuery = useCADStore(s => s.setPropertySearchQuery)

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
      <Input
        className="h-7 text-xs pl-7"
        placeholder="Search properties..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
    </div>
  )
}
