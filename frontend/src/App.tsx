import { Button } from '@/components/ui/button'
import { useCounterStore } from '@/store/useCounterStore'

function App() {
  const { count, increment, reset } = useCounterStore()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Vite + Zustand + Tailwind + shadcn</h1>
      <p className="text-muted-foreground">Count: {count}</p>
      <div className="flex gap-2">
        <Button onClick={increment}>Increment</Button>
        <Button variant="outline" onClick={reset}>
          Reset
        </Button>
      </div>
    </main>
  )
}

export default App
