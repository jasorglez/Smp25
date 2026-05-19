import sql from "mssql";
import dotenv from "dotenv";

dotenv.config({ path: "/Users/alextellezvazquez/mcp-sqlserver/.env" });

async function run() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT),
      database: "warehouses",
      options: { encrypt: true, trustServerCertificate: true }
    });

    const checkQuery = `
      SELECT oc.id, oc.folio
      FROM Ocandreq oc
      INNER JOIN Detailsreqoc d ON oc.id = d.id_movement
      WHERE oc.active = 1
        AND oc.type = 'OC'
        AND oc.id_req = 727
        AND d.id_supplie = 971
        AND d.active = 1
    `;
    const checkResult = await pool.request().query(checkQuery);
    console.table(checkResult.recordset);
    
    await pool.close();
  } catch (err) {
    console.error("Error SQL:", err.message);
  }
}

run();
