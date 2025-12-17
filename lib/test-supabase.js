import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  const { data, error } = await supabase.from('profiles').select('id').limit(1)
  if (error) {
    console.error('❌ Supabase error:', error.message || error)
    process.exit(1)
  }
  console.log('✅ Supabase OK — sample rows:', data)
}

testConnection()