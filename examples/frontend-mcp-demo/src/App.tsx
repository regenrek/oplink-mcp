import { useState } from "react"
import { MonitorSmartphone, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

const features = [
  {
    title: "Chrome DevTools MCP",
    description: "Open a live preview, capture traces, and stream console logs directly into your IDE.",
    icon: MonitorSmartphone,
  },
  {
    title: "shadcn/ui Recipes",
    description: "Install, tweak, or lint UI components without leaving the workflow pane.",
    icon: RefreshCw,
  },
]

export default function App() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16">
        <header className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">shadcn sample</p>
          <h1 className="text-4xl font-semibold">
            Frontend MCP demo
            <span className="text-primary">.</span>
          </h1>
          <p className="text-muted-foreground">
            Spin up a toy UI so the frontend_debugger tool has something to poke.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>Open quick view</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle>Example fragment</DialogTitle>
                  <DialogDescription>
                    This is the element the MCP workflows poke during smoke tests.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
                  <p className="text-muted-foreground">Task</p>
                  <p className="font-medium">Standardize dropdown animation</p>
                  <p className="text-muted-foreground">Owner</p>
                  <p className="font-medium">oplink-frontend</p>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Looks good</Button>
                  </DialogClose>
                  <Button>Open in browser</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload UI
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {features.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-xl border bg-card/40 p-5">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
