import { listProducts } from "./src/modules/metallic-roofing/services/catalogService";
import { db } from "./src/lib/firebase/clientApp";
import { getDocs, collection } from "firebase/firestore";
// Need a script to just run it, but nextjs environment might have issues with imports without tsconfig paths.
