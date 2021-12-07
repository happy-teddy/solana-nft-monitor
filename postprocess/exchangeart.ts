// Helper library written for useful postprocessing tasks with Flat Data
// Has helper functions for manipulating csv, txt, json, excel, zip, and image files
import {
  readJSON,
  writeCSV,
  readCSV,
  removeFile,
} from "https://deno.land/x/flat@0.0.13/mod.ts";

type Item = {
  mintKey: string;
  lastListedPrice: number;
  name: string;
};

type RawData = {
  tokens: Array<Item>;
};

type ParsedData = {
  id: string;
  price: number;
  moonRank?: string;
  score?: number;
  storeURL: string;
};

// Step 1: Read the downloaded_filename JSON
const filename = Deno.args[0];
const collection = filename.split("__")[0];
const data: RawData = await readJSON(filename);
const moonrank: Record<string, string> = await readJSON(
  `.github/moonrank/${collection}.json`
);

// Step 2: Read the existing CSV file, if it exists, and remove old magic eden entries
let csvData: Array<ParsedData> = [];
const csvFilename = `${collection}.csv`;

try {
  const rawData: Array<Record<string, unknown>> = await readCSV(csvFilename);

  csvData = rawData.map((row) => {
    return {
      id: String(row.id),
      price: parseFloat(String(row.price)),
      moonRank: String(row.moonRank),
      score: parseFloat(String(row.score)),
      storeURL: String(row.storeURL),
    };
  });

  csvData = csvData.filter((item) => {
    return !item.storeURL.includes("exchange.art");
  });
} catch (NotFound) {}

let minPrice = Infinity;

// Step 3: Filter specific data we want to keep
const enhancedData: Array<ParsedData> = data.tokens
  .map((item) => {
    let id = item.name || item.mintKey;
    if (id.includes("#")) {
      id = id.split("#")[1];
    }
    const storeURL = `https://exchange.art/single/${item.mintKey}`;

    const itemPrice = item.lastListedPrice / 1000000000;

    if (itemPrice < minPrice) {
      minPrice = itemPrice;
    }

    return {
      id,
      price: itemPrice,
      moonRank: moonrank[id],
      storeURL,
    };
  })
  .filter(Boolean);

// Step 4: Calculate scores
const dataWithScore = enhancedData.map((item) => {
  const { id, price, moonRank, storeURL } = item;
  return {
    id,
    price,
    moonRank,
    score: (price - minPrice) * 100 + parseInt(moonRank || ""),
    storeURL,
  };
});

// Step 5: Update the original CSV with the new data
csvData.push(...dataWithScore);
csvData.sort((a, b) => parseInt(a.id) - parseInt(b.id));

console.log("Processed Items:", enhancedData.length);
console.log("Total Items in CSV:", csvData.length);

await writeCSV(csvFilename, csvData);
console.log("Wrote data");

await removeFile(filename);
