"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useCart } from "@/hooks/use-cart"
import type { User } from "@supabase/supabase-js"

export const useUser = () => {
  const router = useRouter()
  const clearCart = useCart((s) => s.clearCart)
  const fetchCart = useCart((s) => s.fetchCart)
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setMounted(true)
      if (user) fetchCart()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === "SIGNED_IN") {
        fetchCart()
      } else if (event === "SIGNED_OUT") {
        clearCart()
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearCart()
    setUser(null)
    router.push("/")
    router.refresh()
  }

  return { user, mounted, signOut }
}
