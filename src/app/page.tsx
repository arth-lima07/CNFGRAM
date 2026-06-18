import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*");

  return (
    <main>
      <h1>CNFGRAM</h1>

      <p>
        {error
          ? "Erro ao conectar"
          : `Conectado! Perfis encontrados: ${data.length}`}
      </p>
    </main>
  );
}