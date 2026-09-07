// Conexión al proyecto Supabase compartido (base de datos común a todos los
// teléfonos). La "anon key" está pensada para ir en el cliente: el acceso
// real se controla con las políticas de seguridad (RLS) del proyecto.
const SUPABASE_URL = 'https://dgwroemrzptptoyuazzc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnd3JvZW1yenB0cHRveXVhenpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTczNzQsImV4cCI6MjEwNDM3MzM3NH0.UE4lrLiJ48-C2HcTJdIiGbOSxrIAEjmOhOWlmqi-haE';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
