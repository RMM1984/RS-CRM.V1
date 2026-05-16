import 'dotenv/config'
import { pool } from '../config/db'
import { syncAgency, syncAllAgencies } from '../services/ego/egoRealEstate.service'

const main = async () => {
  const vui = process.argv[2]
  const result = vui ? { summaries: [await syncAgency(vui)] } : await syncAllAgencies()

  result.summaries.forEach((summary) => {
    console.log(`🔄 Sincronizando ${summary.agency}...`)
    console.log(
      `✅ Nuevas: ${summary.inserted} | Actualizadas: ${summary.updated} | Sin cambios: ${summary.skipped} | Eliminadas: ${summary.deleted}`
    )
    console.log(`📊 Total: ${summary.total} propiedades`)
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void pool.end()
  })
