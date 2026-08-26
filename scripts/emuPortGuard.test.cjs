const { parsePortHolders, isEmulatorProcess, readEmulatorPorts } = require("./emuPortGuard.cjs");

describe("parsePortHolders — Windows (netstat -ano)", () => {
  it("dedupe: 2 líneas (IPv4 + IPv6) del mismo PID -> [21816]", () => {
    const output =
      "  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       21816\n" +
      "  TCP    [::]:8080              [::]:0                 LISTENING       21816";
    expect(parsePortHolders(output, 8080, "win32")).toEqual([21816]);
  });

  it("salida vacía -> []", () => {
    expect(parsePortHolders("", 8080, "win32")).toEqual([]);
  });

  it("dos PIDs distintos en el mismo puerto -> los dos, sin duplicados", () => {
    const output =
      "  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       21816\n" +
      "  TCP    [::]:8080              [::]:0                 LISTENING       21817";
    const result = parsePortHolders(output, 8080, "win32");
    expect(result.slice().sort((a, b) => a - b)).toEqual([21816, 21817]);
  });

  it("NO matchea :18080 cuando se pide 8080", () => {
    const output = "  TCP    0.0.0.0:18080          0.0.0.0:0              LISTENING       99999";
    expect(parsePortHolders(output, 8080, "win32")).toEqual([]);
  });

  it("NO matchea un puerto REMOTO que termine en :8080 (match va sobre la columna LOCAL)", () => {
    const output = "  TCP    0.0.0.0:9999           1.2.3.4:8080           LISTENING       12345";
    expect(parsePortHolders(output, 8080, "win32")).toEqual([]);
  });

  it("ignora líneas que no estén en LISTENING", () => {
    const output = "  TCP    0.0.0.0:8080           0.0.0.0:0              TIME_WAIT       54321";
    expect(parsePortHolders(output, 8080, "win32")).toEqual([]);
  });
});

describe("parsePortHolders — Linux (lsof -ti :port)", () => {
  it("dos PIDs, uno por línea -> [21816, 21817]", () => {
    expect(parsePortHolders("21816\n21817", 8080, "linux")).toEqual([21816, 21817]);
  });

  it("salida vacía -> []", () => {
    expect(parsePortHolders("", 8080, "linux")).toEqual([]);
  });

  it("con salto de línea final sobrante -> sin NaN en el array", () => {
    const result = parsePortHolders("21816\n21817\n", 8080, "linux");
    expect(result).toEqual([21816, 21817]);
    expect(result.some((n) => Number.isNaN(n))).toBe(false);
  });
});

describe("isEmulatorProcess", () => {
  it("CommandLine real del huérfano (cloud-firestore-emulator) -> true", () => {
    const commandLine =
      '"C:\\Program Files\\Java\\jdk-21\\bin\\java.exe" -Dgoogle.cloud_firestore.debug_log_level=FINE ' +
      "-Duser.language=en -jar C:\\Users\\User\\.cache\\firebase\\emulators\\cloud-firestore-emulator-v1.20.2.jar " +
      "--host 127.0.0.1 --port 8080 --websocket_port 9150 --project_id ayrsteel-test --rules " +
      "C:\\Users\\User\\Documents\\workspace\\ayr\\frontend-ayr-nextjs\\firestore.rules --single_project_mode true " +
      "--functions_emulator 127.0.0.1:5001";
    expect(isEmulatorProcess(commandLine)).toBe(true);
  });

  it('"C:\\\\tomcat\\\\bin\\\\java.exe -jar catalina.jar" -> false', () => {
    expect(isEmulatorProcess("C:\\tomcat\\bin\\java.exe -jar catalina.jar")).toBe(false);
  });

  it("node de un dev server cualquiera -> false", () => {
    expect(isEmulatorProcess("node C:\\Users\\User\\Documents\\workspace\\ayr\\frontend-ayr-nextjs\\node_modules\\.bin\\next dev")).toBe(false);
  });

  it("string vacío -> false", () => {
    expect(isEmulatorProcess("")).toBe(false);
  });

  it("undefined -> false (no tira excepción)", () => {
    expect(isEmulatorProcess(undefined)).toBe(false);
  });

  it("null -> false (no tira excepción)", () => {
    expect(isEmulatorProcess(null)).toBe(false);
  });
});

describe("readEmulatorPorts", () => {
  it("objeto con los 4 puertos declarados -> [8080, 9099, 5001, 9199]", () => {
    const firebaseJson = {
      emulators: {
        auth: { port: 9099 },
        functions: { port: 5001 },
        firestore: { port: 8080 },
        storage: { port: 9199 },
        ui: { enabled: true },
        singleProjectMode: true,
      },
    };
    const result = readEmulatorPorts(firebaseJson);
    expect(result.slice().sort((a, b) => a - b)).toEqual([5001, 8080, 9099, 9199]);
  });

  it("bloque `emulators` ausente -> [] (no explota)", () => {
    expect(readEmulatorPorts({})).toEqual([]);
  });

  it("un emulador declarado SIN `port` (como `ui` hoy) se ignora, sin undefined ni NaN", () => {
    const firebaseJson = {
      emulators: {
        firestore: { port: 8080 },
        ui: { enabled: true },
      },
    };
    const result = readEmulatorPorts(firebaseJson);
    expect(result).toEqual([8080]);
    expect(result.every((n) => typeof n === "number" && !Number.isNaN(n))).toBe(true);
  });
});
