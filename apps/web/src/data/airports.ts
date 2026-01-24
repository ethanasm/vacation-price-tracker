/**
 * Static airport data from OurAirports (large and medium airports only).
 * Source: https://ourairports.com/data/airports.csv
 * 
 * This data is static because airport codes rarely change.
 * Update periodically by re-running the generation script.
 */

export interface Airport {
  code: string;
  name: string;
  city: string | null;
  country: string;
}

export const airports: Airport[] = [
  {
    "code": "AAA",
    "name": "Anaa Airport",
    "city": "Anaa",
    "country": "PF"
  },
  {
    "code": "AAC",
    "name": "El Arish International Airport",
    "city": "El Arish",
    "country": "EG"
  },
  {
    "code": "AAE",
    "name": "Annaba Rabah Bitat Airport",
    "city": "Annaba",
    "country": "DZ"
  },
  {
    "code": "AAL",
    "name": "Aalborg Airport",
    "city": "Aalborg",
    "country": "DK"
  },
  {
    "code": "AAM",
    "name": "Malamala Airport",
    "city": "Malamala",
    "country": "ZA"
  },
  {
    "code": "AAN",
    "name": "Al Ain International Airport",
    "city": "Al Ain",
    "country": "AE"
  },
  {
    "code": "AAO",
    "name": "Anaco Airport",
    "city": "Anaco",
    "country": "VE"
  },
  {
    "code": "AAP",
    "name": "Aji Pangeran Tumenggung Pranoto International Airport",
    "city": "Samarinda",
    "country": "ID"
  },
  {
    "code": "AAQ",
    "name": "Anapa Vityazevo Airport",
    "city": "Krasnyi Kurgan",
    "country": "RU"
  },
  {
    "code": "AAR",
    "name": "Aarhus Airport",
    "city": "Aarhus",
    "country": "DK"
  },
  {
    "code": "AAT",
    "name": "Altay Xuedu Airport",
    "city": "Altay",
    "country": "CN"
  },
  {
    "code": "AAV",
    "name": "Allah Valley Airport",
    "city": "Surallah",
    "country": "PH"
  },
  {
    "code": "AAX",
    "name": "Romeu Zema Airport",
    "city": "Araxá",
    "country": "BR"
  },
  {
    "code": "AAY",
    "name": "Al Ghaydah International Airport",
    "city": "Al Ghaydah",
    "country": "YE"
  },
  {
    "code": "ABA",
    "name": "Abakan International Airport",
    "city": "Abakan",
    "country": "RU"
  },
  {
    "code": "ABB",
    "name": "Asaba International Airport",
    "city": "Asaba",
    "country": "NG"
  },
  {
    "code": "ABC",
    "name": "Albacete Airport / Los Llanos Air Base",
    "city": "Albacete",
    "country": "ES"
  },
  {
    "code": "ABD",
    "name": "Abadan Ayatollah Jami International Airport",
    "city": "Abadan",
    "country": "IR"
  },
  {
    "code": "ABE",
    "name": "Lehigh Valley International Airport",
    "city": "Allentown/Bethlehem",
    "country": "US"
  },
  {
    "code": "ABI",
    "name": "Abilene Regional Airport",
    "city": "Abilene",
    "country": "US"
  },
  {
    "code": "ABJ",
    "name": "Félix-Houphouët-Boigny International Airport",
    "city": "Abidjan",
    "country": "CI"
  },
  {
    "code": "ABK",
    "name": "Kebri Dahar Airport",
    "city": "Kebri Dahar",
    "country": "ET"
  },
  {
    "code": "ABL",
    "name": "Ambler Airport",
    "city": "Ambler",
    "country": "US"
  },
  {
    "code": "ABQ",
    "name": "Albuquerque International Sunport",
    "city": "Albuquerque",
    "country": "US"
  },
  {
    "code": "ABR",
    "name": "Aberdeen Regional Airport",
    "city": "Aberdeen",
    "country": "US"
  },
  {
    "code": "ABS",
    "name": "Abu Simbel Airport",
    "city": "Abu Simbel",
    "country": "EG"
  },
  {
    "code": "ABT",
    "name": "King Saud Bin Abdulaziz (Al Baha) Airport",
    "city": "Al-Baha",
    "country": "SA"
  },
  {
    "code": "ABV",
    "name": "Nnamdi Azikiwe International Airport",
    "city": "Abuja",
    "country": "NG"
  },
  {
    "code": "ABX",
    "name": "Albury Airport",
    "city": "East Albury",
    "country": "AU"
  },
  {
    "code": "ABY",
    "name": "Southwest Georgia Regional Airport",
    "city": "Albany",
    "country": "US"
  },
  {
    "code": "ABZ",
    "name": "Aberdeen International Airport",
    "city": "Aberdeen",
    "country": "GB"
  },
  {
    "code": "ACA",
    "name": "General Juan N. Álvarez International Airport",
    "city": "Acapulco",
    "country": "MX"
  },
  {
    "code": "ACC",
    "name": "Kotoka International Airport",
    "city": "Accra",
    "country": "GH"
  },
  {
    "code": "ACE",
    "name": "César Manrique-Lanzarote Airport",
    "city": "San Bartolomé",
    "country": "ES"
  },
  {
    "code": "ACH",
    "name": "Sankt Gallen Altenrhein Airport",
    "city": "St. Gallen",
    "country": "CH"
  },
  {
    "code": "ACI",
    "name": "Alderney Airport",
    "city": "Saint Anne",
    "country": "GG"
  },
  {
    "code": "ACJ",
    "name": "Anuradhapura Airport",
    "city": "Anuradhapura",
    "country": "LK"
  },
  {
    "code": "ACK",
    "name": "Nantucket Memorial Airport",
    "city": "Nantucket",
    "country": "US"
  },
  {
    "code": "ACS",
    "name": "Achinsk Airport",
    "city": "Achinsk",
    "country": "RU"
  },
  {
    "code": "ACT",
    "name": "Waco Regional Airport",
    "city": "Waco",
    "country": "US"
  },
  {
    "code": "ACV",
    "name": "California Redwood Coast-Humboldt County Airport",
    "city": "Arcata/Eureka",
    "country": "US"
  },
  {
    "code": "ACX",
    "name": "Xingyi Wanfenglin Airport",
    "city": "Xingyi",
    "country": "CN"
  },
  {
    "code": "ACY",
    "name": "Atlantic City International Airport",
    "city": "Atlantic City",
    "country": "US"
  },
  {
    "code": "ACZ",
    "name": "Zabol Airport",
    "city": "Zabol",
    "country": "IR"
  },
  {
    "code": "ADA",
    "name": "Adana Şakirpaşa Airport",
    "city": "Seyhan",
    "country": "TR"
  },
  {
    "code": "ADB",
    "name": "Adnan Menderes International Airport",
    "city": "Gaziemir",
    "country": "TR"
  },
  {
    "code": "ADD",
    "name": "Addis Ababa Bole International Airport",
    "city": "Addis Ababa",
    "country": "ET"
  },
  {
    "code": "ADE",
    "name": "Aden International Airport",
    "city": "Aden",
    "country": "YE"
  },
  {
    "code": "ADF",
    "name": "Adıyaman Airport",
    "city": "Adıyaman",
    "country": "TR"
  },
  {
    "code": "ADI",
    "name": "Arandis Airport",
    "city": "Arandis",
    "country": "NA"
  },
  {
    "code": "ADJ",
    "name": "Marka International (Amman Civil) Airport",
    "city": "Amman",
    "country": "JO"
  },
  {
    "code": "ADK",
    "name": "Adak Airport",
    "city": "Adak",
    "country": "US"
  },
  {
    "code": "ADL",
    "name": "Adelaide International Airport",
    "city": "Adelaide",
    "country": "AU"
  },
  {
    "code": "ADP",
    "name": "Ampara Airport",
    "city": "Ampara",
    "country": "LK"
  },
  {
    "code": "ADQ",
    "name": "Kodiak Airport",
    "city": "Kodiak",
    "country": "US"
  },
  {
    "code": "ADT",
    "name": "Ada Regional Airport",
    "city": "Ada",
    "country": "US"
  },
  {
    "code": "ADU",
    "name": "Ardabil Airport",
    "city": "Ardabil",
    "country": "IR"
  },
  {
    "code": "ADW",
    "name": "Joint Base Andrews",
    "city": "Camp Springs",
    "country": "US"
  },
  {
    "code": "ADX",
    "name": "Leuchars Station Airfield",
    "city": "Leuchars, Fife",
    "country": "GB"
  },
  {
    "code": "ADZ",
    "name": "Gustavo Rojas Pinilla International Airport",
    "city": "San Andrés",
    "country": "CO"
  },
  {
    "code": "AEB",
    "name": "Baise (Bose) Bama Airport",
    "city": "Baise (Tianyang)",
    "country": "CN"
  },
  {
    "code": "AEG",
    "name": "Aek Godang Airport",
    "city": "Padang Sidempuan",
    "country": "ID"
  },
  {
    "code": "AEH",
    "name": "Abeche Airport",
    "city": "Abeche",
    "country": "TD"
  },
  {
    "code": "AEP",
    "name": "Aeroparque Jorge Newbery",
    "city": "Buenos Aires",
    "country": "AR"
  },
  {
    "code": "AER",
    "name": "Sochi International Airport",
    "city": "Sochi",
    "country": "RU"
  },
  {
    "code": "AES",
    "name": "Ålesund Airport",
    "city": "Ålesund",
    "country": "NO"
  },
  {
    "code": "AEU",
    "name": "Abu Musa Island Airport",
    "city": "Abu Musa",
    "country": "IR"
  },
  {
    "code": "AEX",
    "name": "Alexandria International Airport",
    "city": "Alexandria",
    "country": "US"
  },
  {
    "code": "AEY",
    "name": "Akureyri International Airport",
    "city": "Akureyri",
    "country": "IS"
  },
  {
    "code": "AFA",
    "name": "Suboficial Ay Santiago Germano Airport",
    "city": "San Rafael",
    "country": "AR"
  },
  {
    "code": "AFL",
    "name": "Piloto Osvaldo Marques Dias Airport",
    "city": "Alta Floresta",
    "country": "BR"
  },
  {
    "code": "AFW",
    "name": "Perot Field/Fort Worth Alliance Airport",
    "city": "Fort Worth",
    "country": "US"
  },
  {
    "code": "AFY",
    "name": "Afyon Air Base",
    "city": "Afyonkarahisar",
    "country": "TR"
  },
  {
    "code": "AFZ",
    "name": "Sabzevar National Airport",
    "city": "Sabzevar",
    "country": "IR"
  },
  {
    "code": "AGA",
    "name": "Al Massira Airport",
    "city": "Agadir (Temsia)",
    "country": "MA"
  },
  {
    "code": "AGB",
    "name": "Augsburg Airport",
    "city": "Augsburg",
    "country": "DE"
  },
  {
    "code": "AGC",
    "name": "Allegheny County Airport",
    "city": "Pittsburgh",
    "country": "US"
  },
  {
    "code": "AGF",
    "name": "Agen La Garenne airport",
    "city": "Agen",
    "country": "FR"
  },
  {
    "code": "AGH",
    "name": "Ängelholm-Helsingborg Airport",
    "city": "Ängelholm",
    "country": "SE"
  },
  {
    "code": "AGP",
    "name": "Málaga-Costa del Sol Airport",
    "city": "Málaga",
    "country": "ES"
  },
  {
    "code": "AGR",
    "name": "Agra Airport / Agra Air Force Station",
    "city": "Agra",
    "country": "IN"
  },
  {
    "code": "AGS",
    "name": "Augusta Regional At Bush Field",
    "city": "Augusta",
    "country": "US"
  },
  {
    "code": "AGT",
    "name": "Aeropuerto Internacional Guaraní",
    "city": "Ciudad del Este",
    "country": "PY"
  },
  {
    "code": "AGU",
    "name": "Jesús Terán Peredo International Airport",
    "city": "Aguascalientes",
    "country": "MX"
  },
  {
    "code": "AGV",
    "name": "Oswaldo Guevara Mujica Airport",
    "city": "Acarigua",
    "country": "VE"
  },
  {
    "code": "AGX",
    "name": "Agatti Airport",
    "city": "Agatti",
    "country": "IN"
  },
  {
    "code": "AGZ",
    "name": "Aggeneys Airport",
    "city": "Aggeneys",
    "country": "ZA"
  },
  {
    "code": "AHA",
    "name": "Maa Mahamaya Airport",
    "city": "Ambikapur",
    "country": "IN"
  },
  {
    "code": "AHB",
    "name": "Abha International Airport",
    "city": "Abha",
    "country": "SA"
  },
  {
    "code": "AHE",
    "name": "Ahe Airport",
    "city": "Ahe Atoll",
    "country": "PF"
  },
  {
    "code": "AHJ",
    "name": "Hongyuan Airport",
    "city": "Ngawa (Hongyuan)",
    "country": "CN"
  },
  {
    "code": "AHN",
    "name": "Athens Ben Epps Airport",
    "city": "Athens",
    "country": "US"
  },
  {
    "code": "AHO",
    "name": "Alghero-Fertilia Airport",
    "city": "Alghero",
    "country": "IT"
  },
  {
    "code": "AHU",
    "name": "Cherif Al Idrissi Airport",
    "city": "Al Hoceima",
    "country": "MA"
  },
  {
    "code": "AIA",
    "name": "Alliance Municipal Airport",
    "city": "Alliance",
    "country": "US"
  },
  {
    "code": "AIN",
    "name": "Wainwright Airport",
    "city": "Wainwright",
    "country": "US"
  },
  {
    "code": "AJA",
    "name": "Ajaccio Napoléon Bonaparte airport",
    "city": "Ajaccio",
    "country": "FR"
  },
  {
    "code": "AJF",
    "name": "Al-Jawf Domestic Airport",
    "city": "Al-Jawf",
    "country": "SA"
  },
  {
    "code": "AJI",
    "name": "Ağrı Airport",
    "city": "Ağrı",
    "country": "TR"
  },
  {
    "code": "AJL",
    "name": "Lengpui Airport",
    "city": "Aizawl (Lengpui)",
    "country": "IN"
  },
  {
    "code": "AJN",
    "name": "Ouani Airport",
    "city": "Ouani",
    "country": "KM"
  },
  {
    "code": "AJR",
    "name": "Arvidsjaur Airport",
    "city": "Arvidsjaur",
    "country": "SE"
  },
  {
    "code": "AJU",
    "name": "Aracaju - Santa Maria International Airport",
    "city": "Aracaju",
    "country": "BR"
  },
  {
    "code": "AJY",
    "name": "Mano Dayak International Airport",
    "city": "Agadez",
    "country": "NE"
  },
  {
    "code": "AKC",
    "name": "Akron Fulton International Airport",
    "city": "Akron",
    "country": "US"
  },
  {
    "code": "AKD",
    "name": "Akola Airport",
    "city": "Akola",
    "country": "IN"
  },
  {
    "code": "AKF",
    "name": "Kufra Airport",
    "city": "Kufra",
    "country": "LY"
  },
  {
    "code": "AKH",
    "name": "Prince Sultan Air Base",
    "city": "Al Kharj",
    "country": "SA"
  },
  {
    "code": "AKJ",
    "name": "Asahikawa Airport",
    "city": "Higashikagura",
    "country": "JP"
  },
  {
    "code": "AKL",
    "name": "Auckland International Airport",
    "city": "Auckland",
    "country": "NZ"
  },
  {
    "code": "AKN",
    "name": "King Salmon Airport",
    "city": "King Salmon",
    "country": "US"
  },
  {
    "code": "AKP",
    "name": "Anaktuvuk Pass Airport",
    "city": "Anaktuvuk Pass",
    "country": "US"
  },
  {
    "code": "AKR",
    "name": "Akure Airport",
    "city": "Akure",
    "country": "NG"
  },
  {
    "code": "AKT",
    "name": "RAF Akrotiri",
    "city": "Akrotiri",
    "country": "CY"
  },
  {
    "code": "AKU",
    "name": "Aksu Hongqipo Airport",
    "city": "Aksu (Onsu)",
    "country": "CN"
  },
  {
    "code": "AKW",
    "name": "Aghajari Airport",
    "city": "Aghajari",
    "country": "IR"
  },
  {
    "code": "AKX",
    "name": "Aktobe International Airport",
    "city": "Aktobe",
    "country": "KZ"
  },
  {
    "code": "AKY",
    "name": "Sittwe Airport",
    "city": "Sittwe",
    "country": "MM"
  },
  {
    "code": "ALA",
    "name": "Almaty International Airport",
    "city": "Almaty",
    "country": "KZ"
  },
  {
    "code": "ALB",
    "name": "Albany International Airport",
    "city": "Albany",
    "country": "US"
  },
  {
    "code": "ALC",
    "name": "Alicante-Elche Miguel Hernández Airport",
    "city": "Alicante",
    "country": "ES"
  },
  {
    "code": "ALF",
    "name": "Alta Airport",
    "city": "Alta",
    "country": "NO"
  },
  {
    "code": "ALG",
    "name": "Houari Boumediene Airport",
    "city": "Algiers",
    "country": "DZ"
  },
  {
    "code": "ALH",
    "name": "Albany Airport",
    "city": "Albany",
    "country": "AU"
  },
  {
    "code": "ALI",
    "name": "Alice International Airport",
    "city": "Alice",
    "country": "US"
  },
  {
    "code": "ALJ",
    "name": "Alexander Bay Airport",
    "city": "Alexander Bay",
    "country": "ZA"
  },
  {
    "code": "ALM",
    "name": "Alamogordo White Sands Regional Airport",
    "city": "Alamogordo",
    "country": "US"
  },
  {
    "code": "ALN",
    "name": "St Louis Regional Airport",
    "city": "Alton/St Louis",
    "country": "US"
  },
  {
    "code": "ALO",
    "name": "Waterloo Regional Airport",
    "city": "Waterloo",
    "country": "US"
  },
  {
    "code": "ALP",
    "name": "Aleppo International Airport",
    "city": "Aleppo",
    "country": "SY"
  },
  {
    "code": "ALR",
    "name": "Alexandra Aerodrome",
    "city": "Alexandra",
    "country": "NZ"
  },
  {
    "code": "ALS",
    "name": "San Luis Valley Regional Airport/Bergman Field",
    "city": "Alamosa",
    "country": "US"
  },
  {
    "code": "ALW",
    "name": "Walla Walla Regional Airport",
    "city": "Walla Walla",
    "country": "US"
  },
  {
    "code": "AMA",
    "name": "Rick Husband Amarillo International Airport",
    "city": "Amarillo",
    "country": "US"
  },
  {
    "code": "AMD",
    "name": "Sardar Vallabh Patel International Airport",
    "city": "Ahmedabad",
    "country": "IN"
  },
  {
    "code": "AMH",
    "name": "Arba Minch Airport",
    "city": "Arba Minch",
    "country": "ET"
  },
  {
    "code": "AMM",
    "name": "Queen Alia International Airport",
    "city": "Amman",
    "country": "JO"
  },
  {
    "code": "AMQ",
    "name": "Pattimura International Airport",
    "city": "Ambon",
    "country": "ID"
  },
  {
    "code": "AMS",
    "name": "Amsterdam Airport Schiphol",
    "city": "Amsterdam",
    "country": "NL"
  },
  {
    "code": "AMV",
    "name": "Amderma Airport",
    "city": "Amderma",
    "country": "RU"
  },
  {
    "code": "AMZ",
    "name": "Ardmore Airport",
    "city": "Manurewa",
    "country": "NZ"
  },
  {
    "code": "ANB",
    "name": "Anniston Regional Airport",
    "city": "Anniston",
    "country": "US"
  },
  {
    "code": "ANC",
    "name": "Ted Stevens Anchorage International Airport",
    "city": "Anchorage",
    "country": "US"
  },
  {
    "code": "AND",
    "name": "Anderson Regional Airport",
    "city": "Anderson",
    "country": "US"
  },
  {
    "code": "ANE",
    "name": "Angers Marcé airport",
    "city": "Angers",
    "country": "FR"
  },
  {
    "code": "ANF",
    "name": "Andrés Sabella Gálvez International Airport",
    "city": "Antofagasta",
    "country": "CL"
  },
  {
    "code": "ANG",
    "name": "Angoulême Brie-Champniers airport",
    "city": "Angoulême",
    "country": "FR"
  },
  {
    "code": "ANI",
    "name": "Aniak Airport",
    "city": "Aniak",
    "country": "US"
  },
  {
    "code": "ANK",
    "name": "Etimesgut Air Base",
    "city": "Ankara",
    "country": "TR"
  },
  {
    "code": "ANM",
    "name": "Antsirabe Airport",
    "city": "Antsirabe",
    "country": "MG"
  },
  {
    "code": "ANN",
    "name": "Annette Island Airport",
    "city": "Metlakatla",
    "country": "US"
  },
  {
    "code": "ANR",
    "name": "Antwerp International Airport (Deurne)",
    "city": "Antwerp",
    "country": "BE"
  },
  {
    "code": "ANU",
    "name": "V. C. Bird International Airport",
    "city": "Osbourn",
    "country": "AG"
  },
  {
    "code": "ANV",
    "name": "Anvik Airport",
    "city": "Anvik",
    "country": "US"
  },
  {
    "code": "ANX",
    "name": "Andøya Airport, Andenes",
    "city": "Andenes",
    "country": "NO"
  },
  {
    "code": "AOC",
    "name": "Leipzig–Altenburg Airport",
    "city": "Nobitz",
    "country": "DE"
  },
  {
    "code": "AOE",
    "name": "Hasan Polatkan Airport",
    "city": "Eskişehir",
    "country": "TR"
  },
  {
    "code": "AOG",
    "name": "Anshan Teng'ao Airport / Anshan Air Base",
    "city": "Anshan",
    "country": "CN"
  },
  {
    "code": "AOI",
    "name": "Marche Airport",
    "city": "Falconara Marittima (AN)",
    "country": "IT"
  },
  {
    "code": "AOJ",
    "name": "Aomori Airport",
    "city": "Aomori",
    "country": "JP"
  },
  {
    "code": "AOK",
    "name": "Karpathos Airport",
    "city": "Karpathos Island",
    "country": "GR"
  },
  {
    "code": "AOL",
    "name": "Paso De Los Libres Airport",
    "city": "Paso de los Libres",
    "country": "AR"
  },
  {
    "code": "AOO",
    "name": "Altoona Blair County Airport",
    "city": "Altoona",
    "country": "US"
  },
  {
    "code": "AOR",
    "name": "Sultan Abdul Halim Airport",
    "city": "Alor Satar",
    "country": "MY"
  },
  {
    "code": "AOT",
    "name": "Aosta Corrado Gex Airport",
    "city": "Saint-Christophe (AO)",
    "country": "IT"
  },
  {
    "code": "APA",
    "name": "Centennial Airport",
    "city": "Denver",
    "country": "US"
  },
  {
    "code": "APF",
    "name": "Naples Municipal Airport",
    "city": "Naples",
    "country": "US"
  },
  {
    "code": "APG",
    "name": "Phillips Army Air Field",
    "city": "Aberdeen",
    "country": "US"
  },
  {
    "code": "API",
    "name": "Gomez Nino Apiay Air Base",
    "city": "Apiay",
    "country": "CO"
  },
  {
    "code": "APJ",
    "name": "Ali Pulan Airport",
    "city": "Burang Town",
    "country": "CN"
  },
  {
    "code": "APL",
    "name": "Nampula Airport",
    "city": "Nampula",
    "country": "MZ"
  },
  {
    "code": "APN",
    "name": "Alpena County Regional Airport",
    "city": "Alpena",
    "country": "US"
  },
  {
    "code": "APO",
    "name": "Antonio Roldán Betancur Airport",
    "city": "Carepa",
    "country": "CO"
  },
  {
    "code": "APW",
    "name": "Faleolo International Airport",
    "city": "Apia",
    "country": "WS"
  },
  {
    "code": "APZ",
    "name": "Zapala Airport",
    "city": "Zapala",
    "country": "AR"
  },
  {
    "code": "AQA",
    "name": "Araraquara Airport",
    "city": "Araraquara",
    "country": "BR"
  },
  {
    "code": "AQG",
    "name": "Anqing Tianzhushan Airport / Anqing North Air Base",
    "city": "Anqing",
    "country": "CN"
  },
  {
    "code": "AQI",
    "name": "Al Qaisumah/Hafr Al Batin Airport",
    "city": "Qaisumah",
    "country": "SA"
  },
  {
    "code": "AQJ",
    "name": "King Hussein International Airport",
    "city": "Aqaba",
    "country": "JO"
  },
  {
    "code": "AQP",
    "name": "Rodríguez Ballón International Airport",
    "city": "Arequipa",
    "country": "PE"
  },
  {
    "code": "ARA",
    "name": "Acadiana Regional Airport",
    "city": "New Iberia",
    "country": "US"
  },
  {
    "code": "ARC",
    "name": "Arctic Village Airport",
    "city": "Arctic Village",
    "country": "US"
  },
  {
    "code": "ARE",
    "name": "Antonio Nery Juarbe Pol Airport",
    "city": "Arecibo",
    "country": "PR"
  },
  {
    "code": "ARH",
    "name": "Talagi Airport",
    "city": "Archangelsk",
    "country": "RU"
  },
  {
    "code": "ARI",
    "name": "Chacalluta Airport",
    "city": "Arica",
    "country": "CL"
  },
  {
    "code": "ARK",
    "name": "Arusha Airport",
    "city": "Arusha",
    "country": "TZ"
  },
  {
    "code": "ARM",
    "name": "Armidale Airport",
    "city": "Armidale",
    "country": "AU"
  },
  {
    "code": "ARN",
    "name": "Stockholm-Arlanda Airport",
    "city": "Stockholm",
    "country": "SE"
  },
  {
    "code": "ART",
    "name": "Watertown International Airport",
    "city": "Watertown",
    "country": "US"
  },
  {
    "code": "ARU",
    "name": "Araçatuba Airport",
    "city": "Araçatuba",
    "country": "BR"
  },
  {
    "code": "ARW",
    "name": "Arad International Airport",
    "city": "Arad",
    "country": "RO"
  },
  {
    "code": "ARX",
    "name": "Aracati Dragão do Mar Regional Airport",
    "city": "Aracati",
    "country": "BR"
  },
  {
    "code": "ARY",
    "name": "Ararat Airport",
    "city": "Ararat",
    "country": "AU"
  },
  {
    "code": "ASA",
    "name": "Assab International Airport",
    "city": "Assab",
    "country": "ER"
  },
  {
    "code": "ASB",
    "name": "Ashgabat International Airport",
    "city": "Ashgabat",
    "country": "TM"
  },
  {
    "code": "ASD",
    "name": "Andros Town Airport",
    "city": "Andros Town",
    "country": "BS"
  },
  {
    "code": "ASE",
    "name": "Aspen-Pitkin County Airport (Sardy Field)",
    "city": "Aspen",
    "country": "US"
  },
  {
    "code": "ASF",
    "name": "Astrakhan Narimanovo Boris M. Kustodiev International Airport",
    "city": "Astrakhan",
    "country": "RU"
  },
  {
    "code": "ASI",
    "name": "RAF Ascension Island",
    "city": "Cat Hill",
    "country": "SH"
  },
  {
    "code": "ASJ",
    "name": "Amami Airport",
    "city": "Amami",
    "country": "JP"
  },
  {
    "code": "ASK",
    "name": "Yamoussoukro International Airport",
    "city": "Yamoussoukro",
    "country": "CI"
  },
  {
    "code": "ASM",
    "name": "Asmara International Airport",
    "city": "Asmara",
    "country": "ER"
  },
  {
    "code": "ASO",
    "name": "Asosa Airport",
    "city": "Asosa",
    "country": "ET"
  },
  {
    "code": "ASP",
    "name": "Alice Springs Airport",
    "city": "Alice Springs",
    "country": "AU"
  },
  {
    "code": "ASR",
    "name": "Kayseri Erkilet International Airport",
    "city": "Kayseri",
    "country": "TR"
  },
  {
    "code": "AST",
    "name": "Astoria Regional Airport",
    "city": "Astoria",
    "country": "US"
  },
  {
    "code": "ASU",
    "name": "Aeropuerto Internacional Silvio Pettirossi",
    "city": "Asunción",
    "country": "PY"
  },
  {
    "code": "ASV",
    "name": "Amboseli Airport",
    "city": "Amboseli National Park",
    "country": "KE"
  },
  {
    "code": "ASW",
    "name": "Aswan International Airport",
    "city": "Aswan",
    "country": "EG"
  },
  {
    "code": "ATA",
    "name": "Comandante FAP German Arias Graziani Airport",
    "city": "Anta",
    "country": "PE"
  },
  {
    "code": "ATC",
    "name": "Arthur's Town Airport",
    "city": "Arthur's Town",
    "country": "BS"
  },
  {
    "code": "ATF",
    "name": "Chachoán Regional Airport",
    "city": "Ambato",
    "country": "EC"
  },
  {
    "code": "ATG",
    "name": "Minhas Air Base",
    "city": "Kamra",
    "country": "PK"
  },
  {
    "code": "ATH",
    "name": "Athens Eleftherios Venizelos International Airport",
    "city": "Spata-Artemida",
    "country": "GR"
  },
  {
    "code": "ATK",
    "name": "Atqasuk Edward Burnell Sr Memorial Airport",
    "city": "Atqasuk",
    "country": "US"
  },
  {
    "code": "ATL",
    "name": "Hartsfield Jackson Atlanta International Airport",
    "city": "Atlanta",
    "country": "US"
  },
  {
    "code": "ATM",
    "name": "Altamira Interstate Airport",
    "city": "Altamira",
    "country": "BR"
  },
  {
    "code": "ATQ",
    "name": "Sri Guru Ram Das Ji International Airport",
    "city": "Amritsar",
    "country": "IN"
  },
  {
    "code": "ATR",
    "name": "Atar International Airport",
    "city": "Atar",
    "country": "MR"
  },
  {
    "code": "ATW",
    "name": "Appleton International Airport",
    "city": "Appleton",
    "country": "US"
  },
  {
    "code": "ATY",
    "name": "Watertown Regional Airport",
    "city": "Watertown",
    "country": "US"
  },
  {
    "code": "ATZ",
    "name": "Asyut International Airport",
    "city": "Asyut",
    "country": "EG"
  },
  {
    "code": "AUA",
    "name": "Queen Beatrix International Airport",
    "city": "Oranjestad",
    "country": "AW"
  },
  {
    "code": "AUC",
    "name": "Santiago Perez Airport",
    "city": "Arauca",
    "country": "CO"
  },
  {
    "code": "AUF",
    "name": "Auxerre Branches airport",
    "city": "Auxerre",
    "country": "FR"
  },
  {
    "code": "AUG",
    "name": "Augusta State Airport",
    "city": "Augusta",
    "country": "US"
  },
  {
    "code": "AUH",
    "name": "Zayed International Airport",
    "city": "Abu Dhabi",
    "country": "AE"
  },
  {
    "code": "AUQ",
    "name": "Hiva Oa-Atuona Airport",
    "city": "Hiva Oa Island",
    "country": "PF"
  },
  {
    "code": "AUR",
    "name": "Aurillac airport",
    "city": "Aurillac",
    "country": "FR"
  },
  {
    "code": "AUS",
    "name": "Austin Bergstrom International Airport",
    "city": "Austin",
    "country": "US"
  },
  {
    "code": "AUW",
    "name": "Wausau Downtown Airport",
    "city": "Wausau",
    "country": "US"
  },
  {
    "code": "AUX",
    "name": "Araguaína Airport",
    "city": "Araguaína",
    "country": "BR"
  },
  {
    "code": "AVA",
    "name": "Anshun Huangguoshu Airport",
    "city": "Anshun (Xixiu)",
    "country": "CN"
  },
  {
    "code": "AVB",
    "name": "Aviano Air Base",
    "city": "Aviano (PN)",
    "country": "IT"
  },
  {
    "code": "AVI",
    "name": "Máximo Gómez Airport",
    "city": "Ciro Redondo",
    "country": "CU"
  },
  {
    "code": "AVK",
    "name": "Arvaikheer Airport",
    "city": "Arvaikheer",
    "country": "MN"
  },
  {
    "code": "AVL",
    "name": "Asheville Regional Airport",
    "city": "Asheville",
    "country": "US"
  },
  {
    "code": "AVN",
    "name": "Avignon Caumont airport",
    "city": "Avignon",
    "country": "FR"
  },
  {
    "code": "AVP",
    "name": "Wilkes-Barre/Scranton International Airport",
    "city": "Wilkes-Barre/Scranton",
    "country": "US"
  },
  {
    "code": "AVV",
    "name": "Melbourne Avalon International Airport",
    "city": "Geelong/Melbourne",
    "country": "AU"
  },
  {
    "code": "AWA",
    "name": "Hawassa International Airport",
    "city": "Hawassa",
    "country": "ET"
  },
  {
    "code": "AWK",
    "name": "Wake Island Airfield",
    "city": "Wake Island",
    "country": "UM"
  },
  {
    "code": "AWZ",
    "name": "Qasem Soleimani International Airport",
    "city": "Ahvaz",
    "country": "IR"
  },
  {
    "code": "AXA",
    "name": "Clayton J. Lloyd International Airport",
    "city": "The Valley",
    "country": "AI"
  },
  {
    "code": "AXD",
    "name": "Alexandroupoli Democritus Airport",
    "city": "Alexandroupolis",
    "country": "GR"
  },
  {
    "code": "AXF",
    "name": "Alxa Left Banner Bayanhot Airport",
    "city": "Bayanhot",
    "country": "CN"
  },
  {
    "code": "AXK",
    "name": "Ataq Airport",
    "city": "Ataq",
    "country": "YE"
  },
  {
    "code": "AXM",
    "name": "El Eden Airport",
    "city": "Armenia",
    "country": "CO"
  },
  {
    "code": "AXN",
    "name": "Chandler Field",
    "city": "Alexandria",
    "country": "US"
  },
  {
    "code": "AXP",
    "name": "Spring Point Airport",
    "city": "Spring Point",
    "country": "BS"
  },
  {
    "code": "AXR",
    "name": "Arutua Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "AXT",
    "name": "Akita Airport",
    "city": "Akita",
    "country": "JP"
  },
  {
    "code": "AXU",
    "name": "Axum Airport",
    "city": "Axum",
    "country": "ET"
  },
  {
    "code": "AYJ",
    "name": "Maharshi Valmiki International Airport",
    "city": "Faizabad",
    "country": "IN"
  },
  {
    "code": "AYO",
    "name": "Aeropuerto Nacional Juan de Ayolas",
    "city": "Ayolas",
    "country": "PY"
  },
  {
    "code": "AYP",
    "name": "Air Force Colonel Alfredo Mendivil Duarte Airport",
    "city": "Ayacucho",
    "country": "PE"
  },
  {
    "code": "AYQ",
    "name": "Ayers Rock Connellan Airport",
    "city": "Yulara",
    "country": "AU"
  },
  {
    "code": "AYT",
    "name": "Antalya International Airport",
    "city": "Antalya",
    "country": "TR"
  },
  {
    "code": "AYX",
    "name": "Teniente General Gerardo Pérez Pinedo Airport",
    "city": "Atalaya",
    "country": "PE"
  },
  {
    "code": "AZA",
    "name": "Mesa Gateway Airport",
    "city": "Mesa",
    "country": "US"
  },
  {
    "code": "AZD",
    "name": "Shahid Sadooghi Airport",
    "city": "Yazd",
    "country": "IR"
  },
  {
    "code": "AZI",
    "name": "Al Bateen Executive Airport",
    "city": "Abu Dhabi",
    "country": "AE"
  },
  {
    "code": "AZN",
    "name": "Andizhan Airport",
    "city": "Andizhan",
    "country": "UZ"
  },
  {
    "code": "AZO",
    "name": "Kalamazoo/Battle Creek International Airport",
    "city": "Kalamazoo",
    "country": "US"
  },
  {
    "code": "AZR",
    "name": "Touat-Cheikh Sidi Mohamed Belkebir Airport",
    "city": "Adrar",
    "country": "DZ"
  },
  {
    "code": "AZS",
    "name": "Samaná El Catey International Airport",
    "city": "Samana",
    "country": "DO"
  },
  {
    "code": "BAB",
    "name": "Beale Air Force Base",
    "city": "Beale Air Force Base",
    "country": "US"
  },
  {
    "code": "BAD",
    "name": "Barksdale Air Force Base",
    "city": "Bossier City",
    "country": "US"
  },
  {
    "code": "BAF",
    "name": "Westfield-Barnes Regional Airport",
    "city": "Westfield",
    "country": "US"
  },
  {
    "code": "BAG",
    "name": "Loakan Airport",
    "city": "Baguio",
    "country": "PH"
  },
  {
    "code": "BAH",
    "name": "Bahrain International Airport",
    "city": "Manama",
    "country": "BH"
  },
  {
    "code": "BAI",
    "name": "Buenos Aires Airport",
    "city": "Punta Arenas",
    "country": "CR"
  },
  {
    "code": "BAL",
    "name": "Batman Airport",
    "city": "Batman",
    "country": "TR"
  },
  {
    "code": "BAQ",
    "name": "Ernesto Cortissoz International Airport",
    "city": "Barranquilla",
    "country": "CO"
  },
  {
    "code": "BAR",
    "name": "Qionghai Bo'ao Airport",
    "city": "Qionghai (Basuo)",
    "country": "CN"
  },
  {
    "code": "BAT",
    "name": "Chafei Amsei Airport",
    "city": "Barretos",
    "country": "BR"
  },
  {
    "code": "BAV",
    "name": "Baotou Donghe International Airport",
    "city": "Baotou",
    "country": "CN"
  },
  {
    "code": "BAX",
    "name": "Barnaul Gherman Titov International Airport",
    "city": "Barnaul",
    "country": "RU"
  },
  {
    "code": "BAY",
    "name": "Maramureș International Airport",
    "city": "Tăuții-Măgherăuș",
    "country": "RO"
  },
  {
    "code": "BBA",
    "name": "Balmaceda Airport",
    "city": "Balmaceda",
    "country": "CL"
  },
  {
    "code": "BBD",
    "name": "Curtis Field",
    "city": "Brady",
    "country": "US"
  },
  {
    "code": "BBI",
    "name": "Biju Patnaik International Airport",
    "city": "Bhubaneswar",
    "country": "IN"
  },
  {
    "code": "BBK",
    "name": "Kasane International Airport",
    "city": "Kasane",
    "country": "BW"
  },
  {
    "code": "BBM",
    "name": "Battambang Airport",
    "city": "Battambang",
    "country": "KH"
  },
  {
    "code": "BBN",
    "name": "Bario Airport",
    "city": "Bario",
    "country": "MY"
  },
  {
    "code": "BBO",
    "name": "Berbera Airport",
    "city": "Berbera",
    "country": "SO"
  },
  {
    "code": "BBQ",
    "name": "Codrington Airport",
    "city": "Codrington",
    "country": "AG"
  },
  {
    "code": "BBS",
    "name": "Blackbushe Airport",
    "city": "Camberley, Surrey",
    "country": "GB"
  },
  {
    "code": "BBT",
    "name": "Berbérati Airport",
    "city": "Berbérati",
    "country": "CF"
  },
  {
    "code": "BBU",
    "name": "Bucharest Băneasa Aurel Vlaicu International Airport",
    "city": "Bucharest",
    "country": "RO"
  },
  {
    "code": "BCA",
    "name": "Gustavo Rizo Airport",
    "city": "Baracoa",
    "country": "CU"
  },
  {
    "code": "BCD",
    "name": "Bacolod-Silay Airport",
    "city": "Bacolod City",
    "country": "PH"
  },
  {
    "code": "BCE",
    "name": "Bryce Canyon Airport",
    "city": "Bryce Canyon",
    "country": "US"
  },
  {
    "code": "BCH",
    "name": "Baucau Airport",
    "city": "Baucau",
    "country": "TL"
  },
  {
    "code": "BCI",
    "name": "Barcaldine Airport",
    "city": "Barcaldine",
    "country": "AU"
  },
  {
    "code": "BCL",
    "name": "Barra del Colorado Airport",
    "city": "Pococi",
    "country": "CR"
  },
  {
    "code": "BCM",
    "name": "Bacău George Enescu International  Airport",
    "city": "Bacău",
    "country": "RO"
  },
  {
    "code": "BCN",
    "name": "Josep Tarradellas Barcelona-El Prat Airport",
    "city": "Barcelona",
    "country": "ES"
  },
  {
    "code": "BCQ",
    "name": "Brak Airport",
    "city": "Brak",
    "country": "LY"
  },
  {
    "code": "BCT",
    "name": "Boca Raton Airport",
    "city": "Boca Raton",
    "country": "US"
  },
  {
    "code": "BCU",
    "name": "Sir Abubakar Tafawa Balewa Bauchi State International Airport",
    "city": "Bauchi",
    "country": "NG"
  },
  {
    "code": "BCW",
    "name": "Benguera Island Airport",
    "city": "Benguera Island",
    "country": "MZ"
  },
  {
    "code": "BDA",
    "name": "L.F. Wade International Airport",
    "city": "Hamilton",
    "country": "BM"
  },
  {
    "code": "BDB",
    "name": "Bundaberg Airport",
    "city": "Bundaberg",
    "country": "AU"
  },
  {
    "code": "BDE",
    "name": "Baudette International Airport",
    "city": "Baudette",
    "country": "US"
  },
  {
    "code": "BDH",
    "name": "Bandar Lengeh International Airport",
    "city": "Bandar Lengeh",
    "country": "IR"
  },
  {
    "code": "BDJ",
    "name": "Syamsudin Noor International Airport",
    "city": "Landasan Ulin",
    "country": "ID"
  },
  {
    "code": "BDL",
    "name": "Bradley International Airport",
    "city": "Hartford",
    "country": "US"
  },
  {
    "code": "BDM",
    "name": "Bandırma Airport",
    "city": "Bandırma",
    "country": "TR"
  },
  {
    "code": "BDO",
    "name": "Husein Sastranegara International Airport",
    "city": "Bandung",
    "country": "ID"
  },
  {
    "code": "BDQ",
    "name": "Vadodara International Airport",
    "city": "Vadodara",
    "country": "IN"
  },
  {
    "code": "BDR",
    "name": "Igor I Sikorsky Memorial Airport",
    "city": "Bridgeport",
    "country": "US"
  },
  {
    "code": "BDS",
    "name": "Brindisi Airport",
    "city": "Brindisi",
    "country": "IT"
  },
  {
    "code": "BDT",
    "name": "Gbadolite Airport",
    "city": "Gbadolite",
    "country": "CD"
  },
  {
    "code": "BDU",
    "name": "Bardufoss Airport",
    "city": "Målselv",
    "country": "NO"
  },
  {
    "code": "BEB",
    "name": "Benbecula Airport",
    "city": "Balivanich",
    "country": "GB"
  },
  {
    "code": "BED",
    "name": "Laurence G Hanscom Field",
    "city": "Bedford",
    "country": "US"
  },
  {
    "code": "BEF",
    "name": "Bluefields Airport",
    "city": "Bluefields",
    "country": "NI"
  },
  {
    "code": "BEG",
    "name": "Belgrade Nikola Tesla Airport",
    "city": "Belgrade",
    "country": "RS"
  },
  {
    "code": "BEJ",
    "name": "Kalimarau Airport",
    "city": "Tanjung Redeb - Borneo Island",
    "country": "ID"
  },
  {
    "code": "BEK",
    "name": "Bareilly Air Force Station",
    "city": "Bareilly",
    "country": "IN"
  },
  {
    "code": "BEL",
    "name": "Val de Cans/Júlio Cezar Ribeiro International Airport",
    "city": "Belém",
    "country": "BR"
  },
  {
    "code": "BEM",
    "name": "Beni Mellal Airport",
    "city": "Oulad Yaich",
    "country": "MA"
  },
  {
    "code": "BEN",
    "name": "Benina International Airport",
    "city": "Benina",
    "country": "LY"
  },
  {
    "code": "BEP",
    "name": "Bellary Airport",
    "city": "Bellary",
    "country": "IN"
  },
  {
    "code": "BEQ",
    "name": "RAF Honington",
    "city": "Bury Saint Edmunds, Suffolk",
    "country": "GB"
  },
  {
    "code": "BER",
    "name": "Berlin Brandenburg Willy Brandt Airport",
    "city": "Berlin",
    "country": "DE"
  },
  {
    "code": "BES",
    "name": "Brest Bretagne airport",
    "city": "Brest",
    "country": "FR"
  },
  {
    "code": "BET",
    "name": "Bethel Airport",
    "city": "Bethel",
    "country": "US"
  },
  {
    "code": "BEU",
    "name": "Bedourie Airport",
    "city": "Bedourie",
    "country": "AU"
  },
  {
    "code": "BEW",
    "name": "Beira International Airport",
    "city": "Beira",
    "country": "MZ"
  },
  {
    "code": "BEX",
    "name": "RAF Benson",
    "city": "Wallingford, Oxfordshire",
    "country": "GB"
  },
  {
    "code": "BEY",
    "name": "Beirut Rafic Hariri International Airport",
    "city": "Beirut",
    "country": "LB"
  },
  {
    "code": "BFD",
    "name": "Bradford Regional Airport",
    "city": "Bradford",
    "country": "US"
  },
  {
    "code": "BFE",
    "name": "Bielefeld Airport",
    "city": "Bielefeld",
    "country": "DE"
  },
  {
    "code": "BFF",
    "name": "Western Neb. Rgnl/William B. Heilig Airport",
    "city": "Scottsbluff",
    "country": "US"
  },
  {
    "code": "BFH",
    "name": "Bacacheri Airport",
    "city": "Curitiba",
    "country": "BR"
  },
  {
    "code": "BFI",
    "name": "King County International Airport - Boeing Field",
    "city": "Seattle",
    "country": "US"
  },
  {
    "code": "BFJ",
    "name": "Bijie Feixiong Airport",
    "city": "Bijie",
    "country": "CN"
  },
  {
    "code": "BFK",
    "name": "Buckley Space Force Base",
    "city": "Aurora",
    "country": "US"
  },
  {
    "code": "BFL",
    "name": "Meadows Field",
    "city": "Bakersfield",
    "country": "US"
  },
  {
    "code": "BFM",
    "name": "Mobile Downtown Airport",
    "city": "Mobile",
    "country": "US"
  },
  {
    "code": "BFN",
    "name": "Bram Fischer International Airport",
    "city": "Bloemfontein",
    "country": "ZA"
  },
  {
    "code": "BFO",
    "name": "Buffalo Range Airport",
    "city": "Chiredzi",
    "country": "ZW"
  },
  {
    "code": "BFP",
    "name": "Beaver County Airport",
    "city": "Beaver Falls",
    "country": "US"
  },
  {
    "code": "BFS",
    "name": "Belfast International Airport",
    "city": "Belfast",
    "country": "GB"
  },
  {
    "code": "BFU",
    "name": "Bengbu Tenghu Airport",
    "city": "Bengbu",
    "country": "CN"
  },
  {
    "code": "BFV",
    "name": "Buri Ram Airport",
    "city": "Buriram",
    "country": "TH"
  },
  {
    "code": "BFX",
    "name": "Bafoussam Airport",
    "city": "Bafoussam",
    "country": "CM"
  },
  {
    "code": "BFY",
    "name": "Bengbu Tenghu Airport (U.C.)",
    "city": "Bengbu",
    "country": "CN"
  },
  {
    "code": "BGA",
    "name": "Palonegro Airport",
    "city": "Bucaramanga",
    "country": "CO"
  },
  {
    "code": "BGC",
    "name": "Bragança Airport",
    "city": "Bragança",
    "country": "PT"
  },
  {
    "code": "BGF",
    "name": "Bangui M'Poko International Airport",
    "city": "Bangui",
    "country": "CF"
  },
  {
    "code": "BGI",
    "name": "Grantley Adams International Airport",
    "city": "Bridgetown",
    "country": "BB"
  },
  {
    "code": "BGM",
    "name": "Greater Binghamton/Edwin A Link field",
    "city": "Binghamton",
    "country": "US"
  },
  {
    "code": "BGN",
    "name": "Belaya Gora Airport",
    "city": "Belaya Gora",
    "country": "RU"
  },
  {
    "code": "BGO",
    "name": "Bergen Airport, Flesland",
    "city": "Bergen",
    "country": "NO"
  },
  {
    "code": "BGR",
    "name": "Bangor International Airport",
    "city": "Bangor",
    "country": "US"
  },
  {
    "code": "BGW",
    "name": "Baghdad International Airport / New Al Muthana Air Base",
    "city": "Baghdad",
    "country": "IQ"
  },
  {
    "code": "BGX",
    "name": "Comandante Gustavo Kraemer Airport",
    "city": "Bagé",
    "country": "BR"
  },
  {
    "code": "BGY",
    "name": "Il Caravaggio International Airport",
    "city": "Orio al Serio (BG)",
    "country": "IT"
  },
  {
    "code": "BHB",
    "name": "Hancock County-Bar Harbor Airport",
    "city": "Bar Harbor",
    "country": "US"
  },
  {
    "code": "BHD",
    "name": "George Best Belfast City Airport",
    "city": "Belfast",
    "country": "GB"
  },
  {
    "code": "BHE",
    "name": "Woodbourne Airport",
    "city": "Blenheim",
    "country": "NZ"
  },
  {
    "code": "BHH",
    "name": "Bisha Airport",
    "city": "Bisha",
    "country": "SA"
  },
  {
    "code": "BHI",
    "name": "Comandante Espora Airport",
    "city": "Bahía Blanca",
    "country": "AR"
  },
  {
    "code": "BHJ",
    "name": "Bhuj Airport",
    "city": "Bhuj",
    "country": "IN"
  },
  {
    "code": "BHK",
    "name": "Bukhara International Airport",
    "city": "Bukhara",
    "country": "UZ"
  },
  {
    "code": "BHM",
    "name": "Birmingham-Shuttlesworth International Airport",
    "city": "Birmingham",
    "country": "US"
  },
  {
    "code": "BHO",
    "name": "Raja Bhoj International Airport",
    "city": "Bhopal",
    "country": "IN"
  },
  {
    "code": "BHQ",
    "name": "Broken Hill Airport",
    "city": "Broken Hill",
    "country": "AU"
  },
  {
    "code": "BHS",
    "name": "Bathurst Airport",
    "city": "Bathurst",
    "country": "AU"
  },
  {
    "code": "BHU",
    "name": "Bhavnagar Airport",
    "city": "Bhavnagar",
    "country": "IN"
  },
  {
    "code": "BHV",
    "name": "Bahawalpur Airport",
    "city": "Bahawalpur",
    "country": "PK"
  },
  {
    "code": "BHX",
    "name": "Birmingham Airport",
    "city": "Birmingham, West Midlands",
    "country": "GB"
  },
  {
    "code": "BHY",
    "name": "Beihai Fucheng Airport",
    "city": "Beihai (Yinhai)",
    "country": "CN"
  },
  {
    "code": "BIA",
    "name": "Bastia-Poretta International airport",
    "city": "Bastia",
    "country": "FR"
  },
  {
    "code": "BIF",
    "name": "Biggs Army Air Field (Fort Bliss)",
    "city": "Fort Bliss/El Paso",
    "country": "US"
  },
  {
    "code": "BIG",
    "name": "Allen Army Airfield",
    "city": "Delta Junction Ft Greely",
    "country": "US"
  },
  {
    "code": "BIH",
    "name": "Eastern Sierra Regional Airport",
    "city": "Bishop",
    "country": "US"
  },
  {
    "code": "BIK",
    "name": "Frans Kaisiepo Airport",
    "city": "Biak",
    "country": "ID"
  },
  {
    "code": "BIL",
    "name": "Billings Logan International Airport",
    "city": "Billings",
    "country": "US"
  },
  {
    "code": "BIM",
    "name": "South Bimini Airport",
    "city": "South Bimini",
    "country": "BS"
  },
  {
    "code": "BIO",
    "name": "Bilbao Airport",
    "city": "Bilbao",
    "country": "ES"
  },
  {
    "code": "BIQ",
    "name": "Biarritz Pays Basque airport",
    "city": "Biarritz",
    "country": "FR"
  },
  {
    "code": "BIR",
    "name": "Biratnagar Airport",
    "city": "Biratnagar",
    "country": "NP"
  },
  {
    "code": "BIS",
    "name": "Bismarck Municipal Airport",
    "city": "Bismarck",
    "country": "US"
  },
  {
    "code": "BIX",
    "name": "Keesler Air Force Base",
    "city": "Biloxi",
    "country": "US"
  },
  {
    "code": "BIY",
    "name": "Bisho Airport",
    "city": "Bisho",
    "country": "ZA"
  },
  {
    "code": "BJA",
    "name": "Soummam–Abane Ramdane Airport",
    "city": "Béjaïa",
    "country": "DZ"
  },
  {
    "code": "BJB",
    "name": "Bojnord Airport",
    "city": "Bojnord",
    "country": "IR"
  },
  {
    "code": "BJC",
    "name": "Rocky Mountain Metropolitan Airport",
    "city": "Denver",
    "country": "US"
  },
  {
    "code": "BJF",
    "name": "Båtsfjord Airport",
    "city": "Båtsfjord",
    "country": "NO"
  },
  {
    "code": "BJI",
    "name": "Bemidji Regional Airport",
    "city": "Bemidji",
    "country": "US"
  },
  {
    "code": "BJL",
    "name": "Banjul International Airport",
    "city": "Yundum",
    "country": "GM"
  },
  {
    "code": "BJM",
    "name": "Bujumbura Melchior Ndadaye International Airport",
    "city": "Bujumbura",
    "country": "BI"
  },
  {
    "code": "BJO",
    "name": "Bermejo Airport",
    "city": "Bermejo",
    "country": "BO"
  },
  {
    "code": "BJR",
    "name": "Bahir Dar Airport",
    "city": "Bahir Dar",
    "country": "ET"
  },
  {
    "code": "BJV",
    "name": "Milas Bodrum International Airport",
    "city": "Bodrum",
    "country": "TR"
  },
  {
    "code": "BJX",
    "name": "Guanajuato International Airport",
    "city": "Silao",
    "country": "MX"
  },
  {
    "code": "BJY",
    "name": "Batajnica Air Base",
    "city": "Zemun",
    "country": "RS"
  },
  {
    "code": "BJZ",
    "name": "Badajoz Airport",
    "city": "Badajoz",
    "country": "ES"
  },
  {
    "code": "BKA",
    "name": "Baykit Airport",
    "city": "Baykit",
    "country": "RU"
  },
  {
    "code": "BKB",
    "name": "Nal Airport",
    "city": "Bikaner",
    "country": "IN"
  },
  {
    "code": "BKE",
    "name": "Baker City Municipal Airport",
    "city": "Baker City",
    "country": "US"
  },
  {
    "code": "BKG",
    "name": "Branson Airport",
    "city": "Branson",
    "country": "US"
  },
  {
    "code": "BKH",
    "name": "Barking Sands Airport",
    "city": "Kekaha",
    "country": "US"
  },
  {
    "code": "BKI",
    "name": "Kota Kinabalu International Airport",
    "city": "Kota Kinabalu",
    "country": "MY"
  },
  {
    "code": "BKK",
    "name": "Suvarnabhumi Airport",
    "city": "Bangkok",
    "country": "TH"
  },
  {
    "code": "BKL",
    "name": "Burke Lakefront Airport",
    "city": "Cleveland",
    "country": "US"
  },
  {
    "code": "BKO",
    "name": "Modibo Keita International Airport",
    "city": "Bamako",
    "country": "ML"
  },
  {
    "code": "BKQ",
    "name": "Blackall Airport",
    "city": "Blackall",
    "country": "AU"
  },
  {
    "code": "BKS",
    "name": "Fatmawati Soekarno Airport",
    "city": "Bengkulu",
    "country": "ID"
  },
  {
    "code": "BKW",
    "name": "Raleigh County Memorial Airport",
    "city": "Beaver",
    "country": "US"
  },
  {
    "code": "BKY",
    "name": "Bukavu Kavumu Airport",
    "city": "Kamakombe",
    "country": "CD"
  },
  {
    "code": "BLA",
    "name": "General José Antonio Anzoategui International Airport",
    "city": "Barcelona",
    "country": "VE"
  },
  {
    "code": "BLD",
    "name": "Boulder City Municipal Airport",
    "city": "Boulder City",
    "country": "US"
  },
  {
    "code": "BLE",
    "name": "Dala Airport",
    "city": "Borlange",
    "country": "SE"
  },
  {
    "code": "BLF",
    "name": "Mercer County Airport",
    "city": "Bluefield",
    "country": "US"
  },
  {
    "code": "BLH",
    "name": "Blythe Airport",
    "city": "Blythe",
    "country": "US"
  },
  {
    "code": "BLI",
    "name": "Bellingham International Airport",
    "city": "Bellingham",
    "country": "US"
  },
  {
    "code": "BLJ",
    "name": "Batna Mostefa Ben Boulaid Airport",
    "city": "Batna",
    "country": "DZ"
  },
  {
    "code": "BLK",
    "name": "Blackpool Airport",
    "city": "Blackpool",
    "country": "GB"
  },
  {
    "code": "BLL",
    "name": "Billund Airport",
    "city": "Billund",
    "country": "DK"
  },
  {
    "code": "BLN",
    "name": "Benalla Airport",
    "city": "Benalla",
    "country": "AU"
  },
  {
    "code": "BLQ",
    "name": "Bologna Guglielmo Marconi Airport",
    "city": "Bologna",
    "country": "IT"
  },
  {
    "code": "BLR",
    "name": "Kempegowda International Airport Bengaluru",
    "city": "Bangaluru",
    "country": "IN"
  },
  {
    "code": "BLT",
    "name": "Blackwater Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "BLV",
    "name": "Scott AFB/Midamerica Airport",
    "city": "Belleville",
    "country": "US"
  },
  {
    "code": "BLZ",
    "name": "Chileka International Airport",
    "city": "Blantyre",
    "country": "MW"
  },
  {
    "code": "BMA",
    "name": "Stockholm-Bromma Airport",
    "city": "Stockholm",
    "country": "SE"
  },
  {
    "code": "BME",
    "name": "Broome International Airport",
    "city": "Broome",
    "country": "AU"
  },
  {
    "code": "BMG",
    "name": "Monroe County Airport",
    "city": "Bloomington",
    "country": "US"
  },
  {
    "code": "BMI",
    "name": "Central Illinois Regional Airport at Bloomington-Normal",
    "city": "Bloomington/Normal",
    "country": "US"
  },
  {
    "code": "BMM",
    "name": "Bitam Airport",
    "city": "Bitam",
    "country": "GA"
  },
  {
    "code": "BMV",
    "name": "Buon Ma Thuot Airport",
    "city": "Buon Ma Thuot",
    "country": "VN"
  },
  {
    "code": "BNA",
    "name": "Nashville International Airport",
    "city": "Nashville",
    "country": "US"
  },
  {
    "code": "BND",
    "name": "Bandar Abbas International Airport",
    "city": "Bandar Abbas",
    "country": "IR"
  },
  {
    "code": "BNE",
    "name": "Brisbane International Airport",
    "city": "Brisbane",
    "country": "AU"
  },
  {
    "code": "BNI",
    "name": "Benin Airport",
    "city": "Benin",
    "country": "NG"
  },
  {
    "code": "BNK",
    "name": "Ballina Byron Gateway Airport",
    "city": "Ballina",
    "country": "AU"
  },
  {
    "code": "BNN",
    "name": "Brønnøysund Airport, Brønnøy",
    "city": "Brønnøy",
    "country": "NO"
  },
  {
    "code": "BNO",
    "name": "Burns Municipal Airport",
    "city": "Burns",
    "country": "US"
  },
  {
    "code": "BNS",
    "name": "Barinas Airport",
    "city": "Barinas",
    "country": "VE"
  },
  {
    "code": "BNX",
    "name": "Banja Luka International Airport",
    "city": "Mahovljani",
    "country": "BA"
  },
  {
    "code": "BOB",
    "name": "Bora Bora Airport",
    "city": "Motu Mute",
    "country": "PF"
  },
  {
    "code": "BOC",
    "name": "Bocas del Toro International Airport",
    "city": "Isla Colón",
    "country": "PA"
  },
  {
    "code": "BOD",
    "name": "Bordeaux–Mérignac Airport",
    "city": "Bordeaux",
    "country": "FR"
  },
  {
    "code": "BOG",
    "name": "El Dorado International Airport",
    "city": "Bogota",
    "country": "CO"
  },
  {
    "code": "BOH",
    "name": "Bournemouth Airport",
    "city": "Bournemouth",
    "country": "GB"
  },
  {
    "code": "BOI",
    "name": "Boise Air Terminal/Gowen Field",
    "city": "Boise",
    "country": "US"
  },
  {
    "code": "BOJ",
    "name": "Burgas Airport",
    "city": "Burgas",
    "country": "BG"
  },
  {
    "code": "BOM",
    "name": "Chhatrapati Shivaji Maharaj International Airport",
    "city": "Mumbai",
    "country": "IN"
  },
  {
    "code": "BON",
    "name": "Flamingo International Airport",
    "city": "Kralendijk",
    "country": "BQ"
  },
  {
    "code": "BOO",
    "name": "Bodø Airport",
    "city": "Bodø",
    "country": "NO"
  },
  {
    "code": "BOR",
    "name": "Bokeo International Airport",
    "city": "Ton Phueng",
    "country": "LA"
  },
  {
    "code": "BOS",
    "name": "General Edward Lawrence Logan International Airport",
    "city": "Boston",
    "country": "US"
  },
  {
    "code": "BOU",
    "name": "Bourges airport",
    "city": "Bourges",
    "country": "FR"
  },
  {
    "code": "BOY",
    "name": "Bobo Dioulasso Airport",
    "city": "Bobo Dioulasso",
    "country": "BF"
  },
  {
    "code": "BPC",
    "name": "Bamenda Airport",
    "city": "Bamenda",
    "country": "CM"
  },
  {
    "code": "BPE",
    "name": "Qinhuangdao Beidaihe Airport",
    "city": "Qinhuangdao (Changli)",
    "country": "CN"
  },
  {
    "code": "BPG",
    "name": "Barra do Garças Airport",
    "city": "Barra do Garças",
    "country": "BR"
  },
  {
    "code": "BPH",
    "name": "Bislig Airport",
    "city": "Bislig",
    "country": "PH"
  },
  {
    "code": "BPI",
    "name": "Miley Memorial Field",
    "city": "Big Piney",
    "country": "US"
  },
  {
    "code": "BPL",
    "name": "Bole Alashankou Airport",
    "city": "Bole",
    "country": "CN"
  },
  {
    "code": "BPM",
    "name": "Begumpet Airport",
    "city": "Hyderabad",
    "country": "IN"
  },
  {
    "code": "BPN",
    "name": "Sultan Aji Muhammad Sulaiman Sepinggan International Airport",
    "city": "Balikpapan",
    "country": "ID"
  },
  {
    "code": "BPS",
    "name": "Porto Seguro Airport",
    "city": "Porto Seguro",
    "country": "BR"
  },
  {
    "code": "BPT",
    "name": "Jack Brooks Regional Airport",
    "city": "Beaumont/Port Arthur",
    "country": "US"
  },
  {
    "code": "BPX",
    "name": "Qamdo Bangda Airport",
    "city": "Bangda",
    "country": "CN"
  },
  {
    "code": "BPY",
    "name": "Besalampy Airport",
    "city": "Besalampy",
    "country": "MG"
  },
  {
    "code": "BQA",
    "name": "Dr Juan C Angara Airport",
    "city": "Baler",
    "country": "PH"
  },
  {
    "code": "BQH",
    "name": "London Biggin Hill Airport",
    "city": "London",
    "country": "GB"
  },
  {
    "code": "BQK",
    "name": "Brunswick Golden Isles Airport",
    "city": "Brunswick",
    "country": "US"
  },
  {
    "code": "BQL",
    "name": "Boulia Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "BQN",
    "name": "Rafael Hernández International Airport",
    "city": "Aguadilla",
    "country": "PR"
  },
  {
    "code": "BQS",
    "name": "Ignatyevo Airport",
    "city": "Blagoveschensk",
    "country": "RU"
  },
  {
    "code": "BQT",
    "name": "Brest International Airport",
    "city": "Brest",
    "country": "BY"
  },
  {
    "code": "BQU",
    "name": "J F Mitchell Airport",
    "city": "Bequia",
    "country": "VC"
  },
  {
    "code": "BRC",
    "name": "Teniente Luis Candelaria International Airport",
    "city": "San Carlos de Bariloche",
    "country": "AR"
  },
  {
    "code": "BRD",
    "name": "Brainerd Lakes Regional Airport",
    "city": "Brainerd",
    "country": "US"
  },
  {
    "code": "BRE",
    "name": "Bremen Airport",
    "city": "Bremen",
    "country": "DE"
  },
  {
    "code": "BRI",
    "name": "Bari Karol Wojtyła International Airport",
    "city": "Bari",
    "country": "IT"
  },
  {
    "code": "BRK",
    "name": "Bourke Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "BRL",
    "name": "Southeast Iowa Regional Airport",
    "city": "Burlington",
    "country": "US"
  },
  {
    "code": "BRM",
    "name": "Barquisimeto International Airport",
    "city": "Barquisimeto",
    "country": "VE"
  },
  {
    "code": "BRN",
    "name": "Bern Airport",
    "city": "Bern",
    "country": "CH"
  },
  {
    "code": "BRO",
    "name": "Brownsville South Padre Island International Airport",
    "city": "Brownsville",
    "country": "US"
  },
  {
    "code": "BRQ",
    "name": "Brno-Tuřany Airport",
    "city": "Brno",
    "country": "CZ"
  },
  {
    "code": "BRR",
    "name": "Barra Airport",
    "city": "Eoligarry",
    "country": "GB"
  },
  {
    "code": "BRS",
    "name": "Bristol Airport",
    "city": "Bristol",
    "country": "GB"
  },
  {
    "code": "BRT",
    "name": "Bathurst Island Airport",
    "city": "Wurrumiyanga",
    "country": "AU"
  },
  {
    "code": "BRU",
    "name": "Brussels Airport",
    "city": "Zaventem",
    "country": "BE"
  },
  {
    "code": "BRW",
    "name": "Wiley Post Will Rogers Memorial Airport",
    "city": "Utqiaġvik",
    "country": "US"
  },
  {
    "code": "BRX",
    "name": "Maria Montez International Airport",
    "city": "Barahona",
    "country": "DO"
  },
  {
    "code": "BSB",
    "name": "Presidente Juscelino Kubitschek International Airport",
    "city": "Brasília",
    "country": "BR"
  },
  {
    "code": "BSC",
    "name": "José Celestino Mutis Airport",
    "city": "Bahía Solano",
    "country": "CO"
  },
  {
    "code": "BSD",
    "name": "Baoshan Yunrui Airport",
    "city": "Baoshan (Longyang)",
    "country": "CN"
  },
  {
    "code": "BSG",
    "name": "Bata International Airport",
    "city": "Bata",
    "country": "GQ"
  },
  {
    "code": "BSJ",
    "name": "Bairnsdale Airport",
    "city": "Bairnsdale",
    "country": "AU"
  },
  {
    "code": "BSK",
    "name": "Biskra - Mohamed Khider Airport",
    "city": "Biskra",
    "country": "DZ"
  },
  {
    "code": "BSL",
    "name": "EuroAirport Basel–Mulhouse–Freiburg",
    "city": "Bâle / Mulhouse",
    "country": "FR"
  },
  {
    "code": "BSO",
    "name": "Basco Airport",
    "city": "Basco",
    "country": "PH"
  },
  {
    "code": "BSR",
    "name": "Basra International Airport",
    "city": "Basra",
    "country": "IQ"
  },
  {
    "code": "BSZ",
    "name": "Manas International Airport",
    "city": "Bishkek",
    "country": "KG"
  },
  {
    "code": "BTC",
    "name": "Batticaloa International Airport",
    "city": "Batticaloa",
    "country": "LK"
  },
  {
    "code": "BTH",
    "name": "Hang Nadim International Airport",
    "city": "Batam",
    "country": "ID"
  },
  {
    "code": "BTI",
    "name": "Barter Island Long Range Radar Station Airport",
    "city": "Barter Island",
    "country": "US"
  },
  {
    "code": "BTJ",
    "name": "Sultan Iskandar Muda International Airport",
    "city": "Banda Aceh",
    "country": "ID"
  },
  {
    "code": "BTK",
    "name": "Bratsk Airport",
    "city": "Bratsk",
    "country": "RU"
  },
  {
    "code": "BTL",
    "name": "Battle Creek Executive Airport at Kellogg Field",
    "city": "Battle Creek",
    "country": "US"
  },
  {
    "code": "BTM",
    "name": "Bert Mooney Airport",
    "city": "Butte",
    "country": "US"
  },
  {
    "code": "BTR",
    "name": "Baton Rouge Metropolitan Airport",
    "city": "Baton Rouge",
    "country": "US"
  },
  {
    "code": "BTS",
    "name": "M. R. Štefánik Airport",
    "city": "Bratislava",
    "country": "SK"
  },
  {
    "code": "BTU",
    "name": "Bintulu Airport",
    "city": "Bintulu",
    "country": "MY"
  },
  {
    "code": "BTV",
    "name": "Patrick Leahy Burlington International Airport",
    "city": "Burlington",
    "country": "US"
  },
  {
    "code": "BTZ",
    "name": "Betong International Airport",
    "city": "Betong",
    "country": "TH"
  },
  {
    "code": "BUA",
    "name": "Buka Airport",
    "city": "Buka Island",
    "country": "PG"
  },
  {
    "code": "BUD",
    "name": "Budapest Liszt Ferenc International Airport",
    "city": "Budapest",
    "country": "HU"
  },
  {
    "code": "BUF",
    "name": "Buffalo Niagara International Airport",
    "city": "Buffalo",
    "country": "US"
  },
  {
    "code": "BUG",
    "name": "Benguela Airport",
    "city": "Benguela",
    "country": "AO"
  },
  {
    "code": "BUJ",
    "name": "Bou Saada Airport",
    "city": "Ouled Sidi Brahim",
    "country": "DZ"
  },
  {
    "code": "BUN",
    "name": "Gerardo Tobar López Airport",
    "city": "Buenaventura",
    "country": "CO"
  },
  {
    "code": "BUP",
    "name": "Bhatinda Air Force Station",
    "city": null,
    "country": "IN"
  },
  {
    "code": "BUQ",
    "name": "Joshua Mqabuko Nkomo International Airport",
    "city": "Bulawayo",
    "country": "ZW"
  },
  {
    "code": "BUR",
    "name": "Bobe Hope / Hollywood Burbank Airport",
    "city": "Burbank",
    "country": "US"
  },
  {
    "code": "BUS",
    "name": "Alexander Kartveli Batumi International Airport",
    "city": "Batumi",
    "country": "GE"
  },
  {
    "code": "BUX",
    "name": "Bunia Airport",
    "city": "Bunia",
    "country": "CD"
  },
  {
    "code": "BUZ",
    "name": "Bushehr Airport",
    "city": "Bushehr",
    "country": "IR"
  },
  {
    "code": "BVA",
    "name": "Beauvais-Tillé airport",
    "city": "Beauvais",
    "country": "FR"
  },
  {
    "code": "BVB",
    "name": "Atlas Brasil Cantanhede Airport",
    "city": "Boa Vista",
    "country": "BR"
  },
  {
    "code": "BVC",
    "name": "Aristides Pereira International Airport",
    "city": "Rabil",
    "country": "CV"
  },
  {
    "code": "BVE",
    "name": "Brive Souillac airport",
    "city": "Brive",
    "country": "FR"
  },
  {
    "code": "BVG",
    "name": "Berlevåg Airport",
    "city": "Berlevåg",
    "country": "NO"
  },
  {
    "code": "BVH",
    "name": "Brigadeiro Camarão Airport",
    "city": "Vilhena",
    "country": "BR"
  },
  {
    "code": "BVI",
    "name": "Birdsville Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "BVJ",
    "name": "Bovanenkovo Airport",
    "city": "Bovanenkovo",
    "country": "RU"
  },
  {
    "code": "BVY",
    "name": "Beverly Regional Airport",
    "city": "Beverly / Danvers",
    "country": "US"
  },
  {
    "code": "BWA",
    "name": "Gautam Buddha International Airport",
    "city": "Siddharthanagar (Bhairahawa)",
    "country": "NP"
  },
  {
    "code": "BWE",
    "name": "Braunschweig-Wolfsburg Airport",
    "city": "Braunschweig",
    "country": "DE"
  },
  {
    "code": "BWF",
    "name": "Barrow Walney Island Airport",
    "city": "Barrow-in-Furness",
    "country": "GB"
  },
  {
    "code": "BWG",
    "name": "Bowling Green Warren County Regional Airport",
    "city": "Bowling Green",
    "country": "US"
  },
  {
    "code": "BWH",
    "name": "RMAF Butterworth Air Base",
    "city": "Butterworth",
    "country": "MY"
  },
  {
    "code": "BWI",
    "name": "Baltimore/Washington International Thurgood Marshall Airport",
    "city": "Baltimore",
    "country": "US"
  },
  {
    "code": "BWK",
    "name": "Brač Airport",
    "city": "Gornji Humac",
    "country": "HR"
  },
  {
    "code": "BWN",
    "name": "Brunei International Airport",
    "city": "Bandar Seri Begawan",
    "country": "BN"
  },
  {
    "code": "BWO",
    "name": "Balakovo Airport",
    "city": "Balakovo",
    "country": "RU"
  },
  {
    "code": "BWQ",
    "name": "Brewarrina Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "BWT",
    "name": "Wynyard Airport",
    "city": "Burnie",
    "country": "AU"
  },
  {
    "code": "BWU",
    "name": "Sydney Bankstown Airport",
    "city": "Sydney",
    "country": "AU"
  },
  {
    "code": "BXB",
    "name": "Babo Airport",
    "city": "Babo",
    "country": "ID"
  },
  {
    "code": "BXE",
    "name": "Bakel Airport",
    "city": "Bakel",
    "country": "SN"
  },
  {
    "code": "BXH",
    "name": "Balkhash Airport",
    "city": "Balkhash",
    "country": "KZ"
  },
  {
    "code": "BXR",
    "name": "Bam Airport",
    "city": "Bam",
    "country": "IR"
  },
  {
    "code": "BXU",
    "name": "Bancasi Airport",
    "city": "Butuan",
    "country": "PH"
  },
  {
    "code": "BXY",
    "name": "Baikonur Krayniy International Airport",
    "city": "Baikonur",
    "country": "KZ"
  },
  {
    "code": "BYC",
    "name": "Yacuiba Airport",
    "city": "Yacuíba",
    "country": "BO"
  },
  {
    "code": "BYH",
    "name": "Arkansas International Airport",
    "city": "Blytheville",
    "country": "US"
  },
  {
    "code": "BYI",
    "name": "Burley Municipal Airport",
    "city": "Burley",
    "country": "US"
  },
  {
    "code": "BYJ",
    "name": "Beja Airport / Airbase",
    "city": "Beja",
    "country": "PT"
  },
  {
    "code": "BYK",
    "name": "Bouaké Airport",
    "city": "Bouaké",
    "country": "CI"
  },
  {
    "code": "BYM",
    "name": "Carlos Manuel de Cespedes Airport",
    "city": "Bayamo",
    "country": "CU"
  },
  {
    "code": "BYN",
    "name": "Bayankhongor Airport",
    "city": "Bayankhongor",
    "country": "MN"
  },
  {
    "code": "BYS",
    "name": "Bicycle Lake Army Air Field",
    "city": "Fort Irwin/Barstow",
    "country": "US"
  },
  {
    "code": "BYU",
    "name": "Bayreuth Airport",
    "city": "Bindlach",
    "country": "DE"
  },
  {
    "code": "BZB",
    "name": "Bazaruto Island Airport",
    "city": "Bazaruto Island",
    "country": "MZ"
  },
  {
    "code": "BZC",
    "name": "Umberto Modiano Airport",
    "city": "Cabo Frio",
    "country": "BR"
  },
  {
    "code": "BZD",
    "name": "Balranald Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "BZE",
    "name": "Philip S. W. Goldson International Airport",
    "city": "Belize City",
    "country": "BZ"
  },
  {
    "code": "BZG",
    "name": "Ignacy Jan Paderewski Bydgoszcz Airport",
    "city": "Bydgoszcz",
    "country": "PL"
  },
  {
    "code": "BZI",
    "name": "Balıkesir Airport",
    "city": "Balıkesir",
    "country": "TR"
  },
  {
    "code": "BZK",
    "name": "Bryansk Airport",
    "city": "Bryansk",
    "country": "RU"
  },
  {
    "code": "BZL",
    "name": "Barisal Airport",
    "city": "Barisal",
    "country": "BD"
  },
  {
    "code": "BZN",
    "name": "Bozeman Yellowstone International Airport",
    "city": "Bozeman",
    "country": "US"
  },
  {
    "code": "BZO",
    "name": "Bolzano Airport",
    "city": "Bolzano (BZ)",
    "country": "IT"
  },
  {
    "code": "BZR",
    "name": "Béziers Vias airport",
    "city": "Béziers",
    "country": "FR"
  },
  {
    "code": "BZU",
    "name": "Buta Zega Airport",
    "city": "Buta",
    "country": "CD"
  },
  {
    "code": "BZV",
    "name": "Maya-Maya International Airport",
    "city": "Brazzaville",
    "country": "CG"
  },
  {
    "code": "BZY",
    "name": "Bălți International Airport",
    "city": "Bălți",
    "country": "MD"
  },
  {
    "code": "BZZ",
    "name": "RAF Brize Norton",
    "city": "Carterton, Oxfordshire",
    "country": "GB"
  },
  {
    "code": "CAB",
    "name": "Cabinda Airport",
    "city": "Cabinda",
    "country": "AO"
  },
  {
    "code": "CAC",
    "name": "Coronel Adalberto Mendes da Silva Airport",
    "city": "Cascavel",
    "country": "BR"
  },
  {
    "code": "CAE",
    "name": "Columbia Metropolitan Airport",
    "city": "Columbia",
    "country": "US"
  },
  {
    "code": "CAG",
    "name": "Cagliari Elmas Airport",
    "city": "Cagliari",
    "country": "IT"
  },
  {
    "code": "CAH",
    "name": "Cà Mau Airport",
    "city": "Ca Mau City",
    "country": "VN"
  },
  {
    "code": "CAI",
    "name": "Cairo International Airport",
    "city": "Cairo",
    "country": "EG"
  },
  {
    "code": "CAJ",
    "name": "Canaima Airport",
    "city": "Canaima",
    "country": "VE"
  },
  {
    "code": "CAK",
    "name": "Akron Canton Regional Airport",
    "city": "Akron",
    "country": "US"
  },
  {
    "code": "CAL",
    "name": "Campbeltown Airport",
    "city": "Campbeltown",
    "country": "GB"
  },
  {
    "code": "CAN",
    "name": "Guangzhou Baiyun International Airport",
    "city": "Guangzhou (Huadu)",
    "country": "CN"
  },
  {
    "code": "CAP",
    "name": "Cap Haitien International Airport",
    "city": "Cap Haitien",
    "country": "HT"
  },
  {
    "code": "CAQ",
    "name": "Juan H White Airport",
    "city": "Caucasia",
    "country": "CO"
  },
  {
    "code": "CAR",
    "name": "Caribou Municipal Airport",
    "city": "Caribou",
    "country": "US"
  },
  {
    "code": "CAT",
    "name": "Cascais Airport",
    "city": "Cascais",
    "country": "PT"
  },
  {
    "code": "CAW",
    "name": "Bartolomeu Lisandro Airport",
    "city": "Campos dos Goytacazes",
    "country": "BR"
  },
  {
    "code": "CAX",
    "name": "Carlisle Lake District Airport",
    "city": "Carlisle, Cumbria",
    "country": "GB"
  },
  {
    "code": "CAY",
    "name": "Cayenne – Félix Eboué Airport",
    "city": "Matoury",
    "country": "GF"
  },
  {
    "code": "CAZ",
    "name": "Cobar Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CBB",
    "name": "Jorge Wilsterman International Airport",
    "city": "Cochabamba",
    "country": "BO"
  },
  {
    "code": "CBD",
    "name": "Car Nicobar Air Force Base",
    "city": "IAF Camp",
    "country": "IN"
  },
  {
    "code": "CBG",
    "name": "Cambridge City Airport",
    "city": "Cambridge, Cambridgeshire",
    "country": "GB"
  },
  {
    "code": "CBH",
    "name": "Béchar Boudghene Ben Ali Lotfi Airport",
    "city": "Béchar",
    "country": "DZ"
  },
  {
    "code": "CBJ",
    "name": "Cabo Rojo Airport",
    "city": "Cabo Rojo",
    "country": "DO"
  },
  {
    "code": "CBL",
    "name": "General Tomas de Heres Airport",
    "city": "Ciudad Bolivar",
    "country": "VE"
  },
  {
    "code": "CBM",
    "name": "Columbus Air Force Base",
    "city": "Columbus",
    "country": "US"
  },
  {
    "code": "CBO",
    "name": "Cotabato (Awang) Airport",
    "city": "Datu Odin Sinsuat",
    "country": "PH"
  },
  {
    "code": "CBQ",
    "name": "Margaret Ekpo International Airport",
    "city": "Calabar",
    "country": "NG"
  },
  {
    "code": "CBR",
    "name": "Canberra Airport",
    "city": "Canberra",
    "country": "AU"
  },
  {
    "code": "CBT",
    "name": "Catumbela Airport",
    "city": "Catumbela",
    "country": "AO"
  },
  {
    "code": "CBV",
    "name": "Coban Airport",
    "city": "Coban",
    "country": "GT"
  },
  {
    "code": "CCC",
    "name": "Jardines Del Rey Airport",
    "city": "Cayo Coco",
    "country": "CU"
  },
  {
    "code": "CCE",
    "name": "Capital International Airport",
    "city": "New Cairo",
    "country": "EG"
  },
  {
    "code": "CCF",
    "name": "Carcassonne Salvaza Airport",
    "city": "Carcassonne",
    "country": "FR"
  },
  {
    "code": "CCH",
    "name": "Chile Chico Airport",
    "city": "Chile Chico",
    "country": "CL"
  },
  {
    "code": "CCJ",
    "name": "Calicut International Airport",
    "city": "Calicut",
    "country": "IN"
  },
  {
    "code": "CCK",
    "name": "Cocos (Keeling) Islands Airport",
    "city": "West Island",
    "country": "CC"
  },
  {
    "code": "CCL",
    "name": "Chinchilla Airport",
    "city": "Chinchilla",
    "country": "AU"
  },
  {
    "code": "CCM",
    "name": "Forquilhinha - Criciúma  Airport",
    "city": "Criciúma",
    "country": "BR"
  },
  {
    "code": "CCP",
    "name": "Carriel Sur International Airport",
    "city": "Concepcion",
    "country": "CL"
  },
  {
    "code": "CCR",
    "name": "Buchanan Field",
    "city": "Concord",
    "country": "US"
  },
  {
    "code": "CCS",
    "name": "Maiquetía Simón Bolívar International Airport",
    "city": "Maiquetía",
    "country": "VE"
  },
  {
    "code": "CCU",
    "name": "Netaji Subhash Chandra Bose International Airport",
    "city": "Kolkata",
    "country": "IN"
  },
  {
    "code": "CCY",
    "name": "Northeast Iowa Regional Airport",
    "city": "Charles City",
    "country": "US"
  },
  {
    "code": "CCZ",
    "name": "Chub Cay Airport",
    "city": "Chub Cay",
    "country": "BS"
  },
  {
    "code": "CDB",
    "name": "Cold Bay Airport",
    "city": "Cold Bay",
    "country": "US"
  },
  {
    "code": "CDC",
    "name": "Cedar City Regional Airport",
    "city": "Cedar City",
    "country": "US"
  },
  {
    "code": "CDE",
    "name": "Chengde Puning Airport",
    "city": "Chengde",
    "country": "CN"
  },
  {
    "code": "CDG",
    "name": "Charles de Gaulle International Airport",
    "city": "Paris (Roissy-en-France, Val-d'Oise)",
    "country": "FR"
  },
  {
    "code": "CDJ",
    "name": "Conceição do Araguaia Airport",
    "city": "Conceição do Araguaia",
    "country": "BR"
  },
  {
    "code": "CDP",
    "name": "Kadapa Airport",
    "city": "Kadapa",
    "country": "IN"
  },
  {
    "code": "CDR",
    "name": "Chadron Municipal Airport",
    "city": "Chadron",
    "country": "US"
  },
  {
    "code": "CDS",
    "name": "Childress Municipal Airport",
    "city": "Childress",
    "country": "US"
  },
  {
    "code": "CDT",
    "name": "Castellón-Costa Azahar Airport",
    "city": "Castellón de la Plana",
    "country": "ES"
  },
  {
    "code": "CDU",
    "name": "Camden Airport",
    "city": "Cobbitty",
    "country": "AU"
  },
  {
    "code": "CDV",
    "name": "Merle K (Mudhole) Smith Airport",
    "city": "Cordova",
    "country": "US"
  },
  {
    "code": "CEB",
    "name": "Mactan Cebu International Airport",
    "city": "Cebu City/Lapu-Lapu City",
    "country": "PH"
  },
  {
    "code": "CEC",
    "name": "Jack Mc Namara Field Airport",
    "city": "Crescent City",
    "country": "US"
  },
  {
    "code": "CED",
    "name": "Ceduna Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CEE",
    "name": "Cherepovets Airport",
    "city": "Cherepovets",
    "country": "RU"
  },
  {
    "code": "CEF",
    "name": "Westover Metropolitan Airport / Westover Air Reserve Base",
    "city": "Chicopee",
    "country": "US"
  },
  {
    "code": "CEG",
    "name": "Hawarden Airport",
    "city": "Broughton",
    "country": "GB"
  },
  {
    "code": "CEI",
    "name": "Mae Fah Luang - Chiang Rai International Airport",
    "city": "Chiang Rai",
    "country": "TH"
  },
  {
    "code": "CEK",
    "name": "Kurchatov Chelyabinsk International Airport",
    "city": "Chelyabinsk",
    "country": "RU"
  },
  {
    "code": "CEN",
    "name": "Ciudad Obregón International Airport",
    "city": "Ciudad Obregón",
    "country": "MX"
  },
  {
    "code": "CEQ",
    "name": "Cannes Mandelieu Airport",
    "city": "Cannes",
    "country": "FR"
  },
  {
    "code": "CER",
    "name": "Cherbourg Manche airport",
    "city": "Cherbourg",
    "country": "FR"
  },
  {
    "code": "CEW",
    "name": "Bob Sikes Airport",
    "city": "Crestview",
    "country": "US"
  },
  {
    "code": "CEZ",
    "name": "Cortez Municipal Airport",
    "city": "Cortez",
    "country": "US"
  },
  {
    "code": "CFE",
    "name": "Clermont-Ferrand Auvergne airport",
    "city": "Clermont-Ferrand",
    "country": "FR"
  },
  {
    "code": "CFG",
    "name": "Jaime Gonzalez Airport",
    "city": "Cienfuegos",
    "country": "CU"
  },
  {
    "code": "CFK",
    "name": "Chlef Aboubakr Belkaid International Airport",
    "city": "Chlef",
    "country": "DZ"
  },
  {
    "code": "CFN",
    "name": "Donegal Airport",
    "city": "Donegal",
    "country": "IE"
  },
  {
    "code": "CFR",
    "name": "Caen Carpiquet airport",
    "city": "Caen",
    "country": "FR"
  },
  {
    "code": "CFS",
    "name": "Coffs Harbour Airport",
    "city": "Coffs Harbour",
    "country": "AU"
  },
  {
    "code": "CFU",
    "name": "Corfu Ioannis Kapodistrias International Airport",
    "city": "Kerkyra (Corfu)",
    "country": "GR"
  },
  {
    "code": "CGB",
    "name": "Marechal Rondon Airport",
    "city": "Cuiabá",
    "country": "BR"
  },
  {
    "code": "CGD",
    "name": "Changde Taohuayuan Airport",
    "city": "Changde (Dingcheng)",
    "country": "CN"
  },
  {
    "code": "CGF",
    "name": "Cuyahoga County Airport",
    "city": "Cleveland",
    "country": "US"
  },
  {
    "code": "CGH",
    "name": "Congonhas Airport",
    "city": "São Paulo",
    "country": "BR"
  },
  {
    "code": "CGI",
    "name": "Cape Girardeau Regional Airport",
    "city": "Cape Girardeau",
    "country": "US"
  },
  {
    "code": "CGJ",
    "name": "Kasompe Airport",
    "city": "Chingola",
    "country": "ZM"
  },
  {
    "code": "CGK",
    "name": "Soekarno-Hatta International Airport",
    "city": "Jakarta",
    "country": "ID"
  },
  {
    "code": "CGM",
    "name": "Camiguin Airport",
    "city": "Mambajao",
    "country": "PH"
  },
  {
    "code": "CGN",
    "name": "Cologne Bonn Airport",
    "city": "Köln (Cologne)",
    "country": "DE"
  },
  {
    "code": "CGO",
    "name": "Zhengzhou Xinzheng International Airport",
    "city": "Zhengzhou",
    "country": "CN"
  },
  {
    "code": "CGP",
    "name": "Shah Amanat International Airport",
    "city": "Chattogram (Chittagong)",
    "country": "BD"
  },
  {
    "code": "CGQ",
    "name": "Changchun Longjia International Airport",
    "city": "Changchun",
    "country": "CN"
  },
  {
    "code": "CGR",
    "name": "Campo Grande Airport",
    "city": "Campo Grande",
    "country": "BR"
  },
  {
    "code": "CGY",
    "name": "Laguindingan International Airport",
    "city": "Laguindingan",
    "country": "PH"
  },
  {
    "code": "CHA",
    "name": "Chattanooga Metropolitan Airport (Lovell Field)",
    "city": "Chattanooga",
    "country": "US"
  },
  {
    "code": "CHC",
    "name": "Christchurch International Airport",
    "city": "Christchurch",
    "country": "NZ"
  },
  {
    "code": "CHG",
    "name": "Chaoyang Airport",
    "city": "Shuangta, Chaoyang",
    "country": "CN"
  },
  {
    "code": "CHH",
    "name": "Chachapoyas Airport",
    "city": "Chachapoyas",
    "country": "PE"
  },
  {
    "code": "CHM",
    "name": "FAP Lieutenant Jaime Andres de Montreuil Morales Airport",
    "city": "Chimbote",
    "country": "PE"
  },
  {
    "code": "CHO",
    "name": "Charlottesville Albemarle Airport",
    "city": "Charlottesville",
    "country": "US"
  },
  {
    "code": "CHQ",
    "name": "Chania International Airport",
    "city": "Souda",
    "country": "GR"
  },
  {
    "code": "CHR",
    "name": "Châteauroux Déols airport",
    "city": "Châteauroux",
    "country": "FR"
  },
  {
    "code": "CHS",
    "name": "Charleston International Airport",
    "city": "Charleston",
    "country": "US"
  },
  {
    "code": "CHT",
    "name": "Inia William Tuuta Memorial Airport",
    "city": "Te One",
    "country": "NZ"
  },
  {
    "code": "CHX",
    "name": "Changuinola Captain Manuel Niño International Airport",
    "city": "Changuinola",
    "country": "PA"
  },
  {
    "code": "CIA",
    "name": "Ciampino–G. B. Pastine International Airport",
    "city": "Rome",
    "country": "IT"
  },
  {
    "code": "CID",
    "name": "The Eastern Iowa Airport",
    "city": "Cedar Rapids",
    "country": "US"
  },
  {
    "code": "CIF",
    "name": "Chifeng Yulong Airport",
    "city": "Chifeng",
    "country": "CN"
  },
  {
    "code": "CIJ",
    "name": "Capitán Aníbal Arab Airport",
    "city": "Cobija",
    "country": "BO"
  },
  {
    "code": "CIO",
    "name": "Lieutenant Colonel Carmelo Peralta National Airport",
    "city": "Concepción",
    "country": "PY"
  },
  {
    "code": "CIS",
    "name": "Canton Island Airport",
    "city": "Abariringa",
    "country": "KI"
  },
  {
    "code": "CIT",
    "name": "Shymkent International Airport",
    "city": "Shymkent",
    "country": "KZ"
  },
  {
    "code": "CIU",
    "name": "Chippewa County International Airport",
    "city": "Kincheloe",
    "country": "US"
  },
  {
    "code": "CIW",
    "name": "Canouan Airport",
    "city": "Canouan",
    "country": "VC"
  },
  {
    "code": "CIX",
    "name": "Capitán FAP José A. Quiñones González International Airport",
    "city": "Chiclayo",
    "country": "PE"
  },
  {
    "code": "CIY",
    "name": "Comiso Airport",
    "city": "Comiso",
    "country": "IT"
  },
  {
    "code": "CJA",
    "name": "Mayor General FAP Armando Revoredo Iglesias Airport",
    "city": "Cajamarca",
    "country": "PE"
  },
  {
    "code": "CJB",
    "name": "Coimbatore International Airport",
    "city": "Coimbatore",
    "country": "IN"
  },
  {
    "code": "CJC",
    "name": "El Loa Airport",
    "city": "Calama",
    "country": "CL"
  },
  {
    "code": "CJJ",
    "name": "Cheongju International Airport/Cheongju Air Base (K-59/G-513)",
    "city": "Cheongju",
    "country": "KR"
  },
  {
    "code": "CJL",
    "name": "Chitral Airport",
    "city": "Chitral",
    "country": "PK"
  },
  {
    "code": "CJM",
    "name": "Chumphon Airport",
    "city": "Chumphon",
    "country": "TH"
  },
  {
    "code": "CJS",
    "name": "Abraham González International Airport",
    "city": "Ciudad Juárez",
    "country": "MX"
  },
  {
    "code": "CJU",
    "name": "Jeju International Airport",
    "city": "Jeju City",
    "country": "KR"
  },
  {
    "code": "CKB",
    "name": "North Central West Virginia Airport",
    "city": "Bridgeport",
    "country": "US"
  },
  {
    "code": "CKC",
    "name": "Cherkasy International Airport",
    "city": "Cherkasy",
    "country": "UA"
  },
  {
    "code": "CKG",
    "name": "Chongqing Jiangbei International Airport",
    "city": "Chongqing",
    "country": "CN"
  },
  {
    "code": "CKH",
    "name": "Chokurdakh Airport",
    "city": "Chokurdah",
    "country": "RU"
  },
  {
    "code": "CKL",
    "name": "Chkalovskiy Air Base",
    "city": "Moscow",
    "country": "RU"
  },
  {
    "code": "CKS",
    "name": "Carajás Airport",
    "city": "Parauapebas",
    "country": "BR"
  },
  {
    "code": "CKT",
    "name": "Sarakhs Airport",
    "city": "Sarakhs",
    "country": "IR"
  },
  {
    "code": "CKY",
    "name": "Conakry International Airport",
    "city": "Conakry",
    "country": "GN"
  },
  {
    "code": "CKZ",
    "name": "Çanakkale Airport",
    "city": "Çanakkale",
    "country": "TR"
  },
  {
    "code": "CLD",
    "name": "McClellan-Palomar Airport",
    "city": "Carlsbad",
    "country": "US"
  },
  {
    "code": "CLE",
    "name": "Cleveland Hopkins International Airport",
    "city": "Cleveland",
    "country": "US"
  },
  {
    "code": "CLJ",
    "name": "Avram Iancu Cluj International Airport",
    "city": "Cluj-Napoca",
    "country": "RO"
  },
  {
    "code": "CLL",
    "name": "Easterwood Field",
    "city": "College Station",
    "country": "US"
  },
  {
    "code": "CLM",
    "name": "William R Fairchild International Airport",
    "city": "Port Angeles",
    "country": "US"
  },
  {
    "code": "CLN",
    "name": "Brig. Lysias Augusto Rodrigues Airport",
    "city": "Carolina",
    "country": "BR"
  },
  {
    "code": "CLO",
    "name": "Alfonso Bonilla Aragon International Airport",
    "city": "Cali",
    "country": "CO"
  },
  {
    "code": "CLQ",
    "name": "Licenciado Miguel de la Madrid International Airport",
    "city": "Colima",
    "country": "MX"
  },
  {
    "code": "CLT",
    "name": "Charlotte Douglas International Airport",
    "city": "Charlotte",
    "country": "US"
  },
  {
    "code": "CLU",
    "name": "Columbus Municipal Airport",
    "city": "Columbus",
    "country": "US"
  },
  {
    "code": "CLY",
    "name": "Calvi Sainte Catherine Airport",
    "city": "Calvi",
    "country": "FR"
  },
  {
    "code": "CLZ",
    "name": "Calabozo Airport",
    "city": "Guarico",
    "country": "VE"
  },
  {
    "code": "CMA",
    "name": "Cunnamulla Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CMB",
    "name": "Bandaranaike International Colombo Airport",
    "city": "Colombo",
    "country": "LK"
  },
  {
    "code": "CMD",
    "name": "Cootamundra Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CME",
    "name": "Ciudad del Carmen International Airport",
    "city": "Ciudad del Carmen",
    "country": "MX"
  },
  {
    "code": "CMF",
    "name": "Chambéry Aix les Bains airport",
    "city": "Chambéry",
    "country": "FR"
  },
  {
    "code": "CMG",
    "name": "Corumbá International Airport",
    "city": "Corumbá",
    "country": "BR"
  },
  {
    "code": "CMH",
    "name": "John Glenn Columbus International Airport",
    "city": "Columbus",
    "country": "US"
  },
  {
    "code": "CMI",
    "name": "University of Illinois Willard Airport",
    "city": "Savoy",
    "country": "US"
  },
  {
    "code": "CMN",
    "name": "Mohammed V International Airport",
    "city": "Casablanca",
    "country": "MA"
  },
  {
    "code": "CMQ",
    "name": "Clermont Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CMR",
    "name": "Colmar Houssen airport",
    "city": "Colmar",
    "country": "FR"
  },
  {
    "code": "CMU",
    "name": "Chimbu Airport",
    "city": "Kundiawa",
    "country": "PG"
  },
  {
    "code": "CMW",
    "name": "Ignacio Agramonte International Airport",
    "city": "Camaguey",
    "country": "CU"
  },
  {
    "code": "CMX",
    "name": "Houghton County Memorial Airport",
    "city": "Hancock",
    "country": "US"
  },
  {
    "code": "CNB",
    "name": "Coonamble Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CND",
    "name": "Mihail Kogălniceanu International Airport",
    "city": "Constanța",
    "country": "RO"
  },
  {
    "code": "CNF",
    "name": "Tancredo Neves International Airport",
    "city": "Belo Horizonte",
    "country": "BR"
  },
  {
    "code": "CNG",
    "name": "Cognac-Châteaubernard (BA 709) Air Base",
    "city": "Cognac/Châteaubernard",
    "country": "FR"
  },
  {
    "code": "CNJ",
    "name": "Cloncurry Airport",
    "city": "Cloncurry",
    "country": "AU"
  },
  {
    "code": "CNL",
    "name": "Sindal Airport",
    "city": "Sindal",
    "country": "DK"
  },
  {
    "code": "CNM",
    "name": "Cavern City Air Terminal",
    "city": "Carlsbad",
    "country": "US"
  },
  {
    "code": "CNN",
    "name": "Kannur International Airport",
    "city": "Kannur",
    "country": "IN"
  },
  {
    "code": "CNP",
    "name": "Neerlerit Inaat Airport",
    "city": "Neerlerit Inaat",
    "country": "GL"
  },
  {
    "code": "CNQ",
    "name": "Corrientes Airport",
    "city": "Corrientes",
    "country": "AR"
  },
  {
    "code": "CNR",
    "name": "Chañaral Airport",
    "city": "Chañaral",
    "country": "CL"
  },
  {
    "code": "CNS",
    "name": "Cairns International Airport",
    "city": "Cairns",
    "country": "AU"
  },
  {
    "code": "CNU",
    "name": "Chanute Martin Johnson Airport",
    "city": "Chanute",
    "country": "US"
  },
  {
    "code": "CNX",
    "name": "Chiang Mai International Airport",
    "city": "Chiang Mai",
    "country": "TH"
  },
  {
    "code": "CNY",
    "name": "Canyonlands Regional Airport",
    "city": "Moab",
    "country": "US"
  },
  {
    "code": "COC",
    "name": "Comodoro Pierrestegui Airport",
    "city": "Concordia",
    "country": "AR"
  },
  {
    "code": "COD",
    "name": "Yellowstone Regional Airport",
    "city": "Cody",
    "country": "US"
  },
  {
    "code": "COE",
    "name": "Coeur D'Alene Airport - Pappy Boyington Field",
    "city": "Coeur d'Alene",
    "country": "US"
  },
  {
    "code": "COF",
    "name": "Patrick Space Force Base",
    "city": "Cocoa Beach",
    "country": "US"
  },
  {
    "code": "COJ",
    "name": "Coonabarabran Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "COK",
    "name": "Cochin International Airport",
    "city": "Kochi",
    "country": "IN"
  },
  {
    "code": "CON",
    "name": "Concord Municipal Airport",
    "city": "Concord",
    "country": "US"
  },
  {
    "code": "COO",
    "name": "Cotonou Cadjehoun International Airport",
    "city": "Cotonou",
    "country": "BJ"
  },
  {
    "code": "COQ",
    "name": "Choibalsan Airport",
    "city": null,
    "country": "MN"
  },
  {
    "code": "COR",
    "name": "Ingeniero Aeronáutico Ambrosio L.V. Taravella International Airport",
    "city": "Cordoba",
    "country": "AR"
  },
  {
    "code": "COS",
    "name": "City of Colorado Springs Municipal Airport",
    "city": "Colorado Springs",
    "country": "US"
  },
  {
    "code": "COU",
    "name": "Columbia Regional Airport",
    "city": "Columbia",
    "country": "US"
  },
  {
    "code": "COV",
    "name": "Çukurova International Airport",
    "city": "Tarsus",
    "country": "TR"
  },
  {
    "code": "CPC",
    "name": "Aviador C. Campos Airport",
    "city": "Chapelco/San Martin de los Andes",
    "country": "AR"
  },
  {
    "code": "CPD",
    "name": "Coober Pedy Airport",
    "city": "Coober Pedy",
    "country": "AU"
  },
  {
    "code": "CPE",
    "name": "Ingeniero Alberto Acuña Ongay International Airport",
    "city": "Campeche",
    "country": "MX"
  },
  {
    "code": "CPH",
    "name": "Copenhagen Kastrup Airport",
    "city": "Copenhagen",
    "country": "DK"
  },
  {
    "code": "CPO",
    "name": "Desierto de Atacama Airport",
    "city": "Copiapo",
    "country": "CL"
  },
  {
    "code": "CPR",
    "name": "Casper-Natrona County International Airport",
    "city": "Casper",
    "country": "US"
  },
  {
    "code": "CPT",
    "name": "Cape Town International Airport",
    "city": "Cape Town",
    "country": "ZA"
  },
  {
    "code": "CPV",
    "name": "Presidente João Suassuna Airport",
    "city": "Campina Grande",
    "country": "BR"
  },
  {
    "code": "CPX",
    "name": "Benjamin Rivera Noriega Airport",
    "city": "Culebra",
    "country": "PR"
  },
  {
    "code": "CQD",
    "name": "Shahrekord Airport",
    "city": "Shahrekord",
    "country": "IR"
  },
  {
    "code": "CQF",
    "name": "Calais Marck Airport",
    "city": "Calais",
    "country": "FR"
  },
  {
    "code": "CQM",
    "name": "Ciudad Real International Airport",
    "city": "Ciudad Real",
    "country": "ES"
  },
  {
    "code": "CQW",
    "name": "Chongqing Xiannüshan Airport",
    "city": "Wulong",
    "country": "CN"
  },
  {
    "code": "CRA",
    "name": "Craiova International Airport",
    "city": "Craiova",
    "country": "RO"
  },
  {
    "code": "CRC",
    "name": "Santa Ana Airport",
    "city": "Cartago",
    "country": "CO"
  },
  {
    "code": "CRD",
    "name": "General Enrique Mosconi International Airport",
    "city": "Comodoro Rivadavia",
    "country": "AR"
  },
  {
    "code": "CRE",
    "name": "Grand Strand Airport",
    "city": "North Myrtle Beach",
    "country": "US"
  },
  {
    "code": "CRG",
    "name": "Jacksonville Executive at Craig Airport",
    "city": "Jacksonville",
    "country": "US"
  },
  {
    "code": "CRI",
    "name": "Colonel Hill Airport",
    "city": "Colonel Hill",
    "country": "BS"
  },
  {
    "code": "CRK",
    "name": "Clark International Airport / Clark Air Base",
    "city": "Mabalacat",
    "country": "PH"
  },
  {
    "code": "CRL",
    "name": "Brussels South Charleroi Airport",
    "city": "Charleroi",
    "country": "BE"
  },
  {
    "code": "CRM",
    "name": "Catarman National Airport",
    "city": "Catarman",
    "country": "PH"
  },
  {
    "code": "CRP",
    "name": "Corpus Christi International Airport",
    "city": "Corpus Christi",
    "country": "US"
  },
  {
    "code": "CRQ",
    "name": "Caravelas Airport",
    "city": "Caravelas",
    "country": "BR"
  },
  {
    "code": "CRV",
    "name": "Crotone Sant'Anna Pythagoras Airport",
    "city": "Isola di Capo Rizzuto (KR)",
    "country": "IT"
  },
  {
    "code": "CRW",
    "name": "Yeager Airport",
    "city": "Charleston",
    "country": "US"
  },
  {
    "code": "CRZ",
    "name": "Türkmenabat International Airport",
    "city": "Türkmenabat",
    "country": "TM"
  },
  {
    "code": "CSB",
    "name": "Caransebeş Airport",
    "city": "Caransebeş",
    "country": "RO"
  },
  {
    "code": "CSF",
    "name": "Creil Air Base",
    "city": "Creil",
    "country": "FR"
  },
  {
    "code": "CSG",
    "name": "Columbus Airport",
    "city": "Columbus",
    "country": "US"
  },
  {
    "code": "CSK",
    "name": "Cap Skirring Airport",
    "city": "Cap Skirring",
    "country": "SN"
  },
  {
    "code": "CSN",
    "name": "Carson Airport",
    "city": "Carson City",
    "country": "US"
  },
  {
    "code": "CSV",
    "name": "Crossville Memorial Airport Whitson Field",
    "city": "Crossville",
    "country": "US"
  },
  {
    "code": "CSX",
    "name": "Changsha Huanghua International Airport",
    "city": "Changsha (Changsha)",
    "country": "CN"
  },
  {
    "code": "CSY",
    "name": "Cheboksary Airport",
    "city": "Cheboksary",
    "country": "RU"
  },
  {
    "code": "CTA",
    "name": "Catania-Fontanarossa Airport",
    "city": "Catania",
    "country": "IT"
  },
  {
    "code": "CTB",
    "name": "Cut Bank International Airport",
    "city": "Cut Bank",
    "country": "US"
  },
  {
    "code": "CTC",
    "name": "Coronel Felipe Varela International Airport",
    "city": "Catamarca",
    "country": "AR"
  },
  {
    "code": "CTD",
    "name": "Alonso Valderrama Airport",
    "city": "Chitré",
    "country": "PA"
  },
  {
    "code": "CTG",
    "name": "Rafael Nuñez International Airport",
    "city": "Cartagena",
    "country": "CO"
  },
  {
    "code": "CTL",
    "name": "Charleville Airport",
    "city": "Charleville",
    "country": "AU"
  },
  {
    "code": "CTM",
    "name": "Chetumal International Airport",
    "city": "Chetumal",
    "country": "MX"
  },
  {
    "code": "CTN",
    "name": "Cooktown Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CTS",
    "name": "New Chitose Airport",
    "city": "Sapporo",
    "country": "JP"
  },
  {
    "code": "CTT",
    "name": "Le Castellet Airport",
    "city": "Le Castellet, Var",
    "country": "FR"
  },
  {
    "code": "CTU",
    "name": "Chengdu Shuangliu International Airport",
    "city": "Chengdu (Shuangliu)",
    "country": "CN"
  },
  {
    "code": "CUB",
    "name": "Jim Hamilton L.B. Owens Airport",
    "city": "Columbia",
    "country": "US"
  },
  {
    "code": "CUC",
    "name": "Camilo Daza International Airport",
    "city": "Cúcuta",
    "country": "CO"
  },
  {
    "code": "CUE",
    "name": "Mariscal Lamar Airport",
    "city": "Cuenca",
    "country": "EC"
  },
  {
    "code": "CUF",
    "name": "Cuneo International Airport",
    "city": "Levaldigi (CN)",
    "country": "IT"
  },
  {
    "code": "CUK",
    "name": "Caye Caulker Airport",
    "city": "Caye Caulker",
    "country": "BZ"
  },
  {
    "code": "CUL",
    "name": "Bachigualato Federal International Airport",
    "city": "Culiacán",
    "country": "MX"
  },
  {
    "code": "CUM",
    "name": "Antonio José de Sucre Airport",
    "city": "Cumaná",
    "country": "VE"
  },
  {
    "code": "CUN",
    "name": "Cancún International Airport",
    "city": "Cancún",
    "country": "MX"
  },
  {
    "code": "CUP",
    "name": "General Francisco Bermúdez Airport",
    "city": "Carúpano",
    "country": "VE"
  },
  {
    "code": "CUQ",
    "name": "Coen Airport",
    "city": "Coen",
    "country": "AU"
  },
  {
    "code": "CUR",
    "name": "Hato International Airport",
    "city": "Willemstad",
    "country": "CW"
  },
  {
    "code": "CUT",
    "name": "Cutral-Co Airport",
    "city": "Cutral-Co",
    "country": "AR"
  },
  {
    "code": "CUU",
    "name": "General Roberto Fierro Villalobos International Airport",
    "city": "Chihuahua",
    "country": "MX"
  },
  {
    "code": "CUZ",
    "name": "Alejandro Velasco Astete International Airport",
    "city": "Cusco",
    "country": "PE"
  },
  {
    "code": "CVC",
    "name": "Cleve Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CVE",
    "name": "Coveñas Airport",
    "city": "Coveñas",
    "country": "CO"
  },
  {
    "code": "CVG",
    "name": "Cincinnati Northern Kentucky International Airport",
    "city": "Cincinnati / Covington",
    "country": "US"
  },
  {
    "code": "CVJ",
    "name": "General Mariano Matamoros International Airport",
    "city": "Temixco",
    "country": "MX"
  },
  {
    "code": "CVM",
    "name": "General Pedro Jose Mendez International Airport",
    "city": "Ciudad Victoria",
    "country": "MX"
  },
  {
    "code": "CVN",
    "name": "Clovis Municipal Airport",
    "city": "Clovis",
    "country": "US"
  },
  {
    "code": "CVO",
    "name": "Corvallis Municipal Airport",
    "city": "Corvallis",
    "country": "US"
  },
  {
    "code": "CVQ",
    "name": "Carnarvon Airport",
    "city": "Carnarvon",
    "country": "AU"
  },
  {
    "code": "CVS",
    "name": "Cannon Air Force Base",
    "city": "Clovis",
    "country": "US"
  },
  {
    "code": "CVT",
    "name": "Coventry Airport",
    "city": "Coventry, West Midlands",
    "country": "GB"
  },
  {
    "code": "CWA",
    "name": "Central Wisconsin Airport",
    "city": "Mosinee",
    "country": "US"
  },
  {
    "code": "CWB",
    "name": "Curitiba-Afonso Pena International Airport",
    "city": "Curitiba",
    "country": "BR"
  },
  {
    "code": "CWC",
    "name": "Chernivtsi International Airport",
    "city": "Chernivtsi",
    "country": "UA"
  },
  {
    "code": "CWJ",
    "name": "Cangyuan Washan Airport",
    "city": "Lincang (Cangyuan)",
    "country": "CN"
  },
  {
    "code": "CWL",
    "name": "Cardiff International Airport",
    "city": "Cardiff",
    "country": "GB"
  },
  {
    "code": "CWT",
    "name": "Cowra Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CWW",
    "name": "Corowa Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CXA",
    "name": "Caicara del Orinoco Airport",
    "city": null,
    "country": "VE"
  },
  {
    "code": "CXB",
    "name": "Cox's Bazar Airport",
    "city": "Cox's Bazar",
    "country": "BD"
  },
  {
    "code": "CXI",
    "name": "Cassidy International Airport",
    "city": "Kiritimati",
    "country": "KI"
  },
  {
    "code": "CXJ",
    "name": "Hugo Cantergiani Regional Airport",
    "city": "Caxias Do Sul",
    "country": "BR"
  },
  {
    "code": "CXO",
    "name": "Conroe-North Houston Regional Airport",
    "city": "Houston",
    "country": "US"
  },
  {
    "code": "CXP",
    "name": "Tunggul Wulung Airport",
    "city": "Cilacap",
    "country": "ID"
  },
  {
    "code": "CXR",
    "name": "Cam Ranh International Airport / Cam Ranh Air Base",
    "city": "Nha Trang/nha Trang aiurportCam Ranh",
    "country": "VN"
  },
  {
    "code": "CYA",
    "name": "Antoine-Simon International Airport",
    "city": "Les Cayes",
    "country": "HT"
  },
  {
    "code": "CYB",
    "name": "Charles Kirkconnell International Airport",
    "city": "West End",
    "country": "KY"
  },
  {
    "code": "CYC",
    "name": "Caye Chapel Airport",
    "city": "Caye Chapel",
    "country": "BZ"
  },
  {
    "code": "CYG",
    "name": "Corryong Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "CYI",
    "name": "Chiayi Airport",
    "city": "Shuishang",
    "country": "TW"
  },
  {
    "code": "CYO",
    "name": "Vilo Acuña International Airport",
    "city": "Cayo Largo del Sur",
    "country": "CU"
  },
  {
    "code": "CYP",
    "name": "Calbayog Airport",
    "city": "Calbayog City",
    "country": "PH"
  },
  {
    "code": "CYS",
    "name": "Cheyenne Regional Jerry Olson Field",
    "city": "Cheyenne",
    "country": "US"
  },
  {
    "code": "CYW",
    "name": "Captain Rogelio Castillo National Airport",
    "city": "Celaya",
    "country": "MX"
  },
  {
    "code": "CYX",
    "name": "Cherskiy Airport",
    "city": "Cherskiy",
    "country": "RU"
  },
  {
    "code": "CYZ",
    "name": "Cauayan Airport",
    "city": "Cauayan City",
    "country": "PH"
  },
  {
    "code": "CZE",
    "name": "José Leonardo Chirinos Airport",
    "city": "Coro",
    "country": "VE"
  },
  {
    "code": "CZF",
    "name": "Cape Romanzof LRRS Airport",
    "city": "Cape Romanzof",
    "country": "US"
  },
  {
    "code": "CZH",
    "name": "Corozal Airport",
    "city": "Corozal",
    "country": "BZ"
  },
  {
    "code": "CZL",
    "name": "Mohamed Boudiaf International Airport",
    "city": "Constantine",
    "country": "DZ"
  },
  {
    "code": "CZM",
    "name": "Cozumel International Airport",
    "city": "Cozumel",
    "country": "MX"
  },
  {
    "code": "CZS",
    "name": "Cruzeiro do Sul Airport",
    "city": "Cruzeiro Do Sul",
    "country": "BR"
  },
  {
    "code": "CZU",
    "name": "Las Brujas Airport",
    "city": "Corozal",
    "country": "CO"
  },
  {
    "code": "CZX",
    "name": "Changzhou Benniu International Airport",
    "city": "Changzhou",
    "country": "CN"
  },
  {
    "code": "DAA",
    "name": "Davison Army Air Field",
    "city": "Fort Belvoir",
    "country": "US"
  },
  {
    "code": "DAB",
    "name": "Daytona Beach International Airport",
    "city": "Daytona Beach",
    "country": "US"
  },
  {
    "code": "DAC",
    "name": "Hazrat Shahjalal International Airport",
    "city": "Dhaka",
    "country": "BD"
  },
  {
    "code": "DAD",
    "name": "Da Nang International Airport",
    "city": "Da Nang",
    "country": "VN"
  },
  {
    "code": "DAG",
    "name": "Barstow Daggett Airport",
    "city": "Daggett",
    "country": "US"
  },
  {
    "code": "DAL",
    "name": "Dallas Love Field",
    "city": "Dallas",
    "country": "US"
  },
  {
    "code": "DAM",
    "name": "Damascus International Airport",
    "city": "Damascus",
    "country": "SY"
  },
  {
    "code": "DAN",
    "name": "Danville Regional Airport",
    "city": "Danville",
    "country": "US"
  },
  {
    "code": "DAR",
    "name": "Julius Nyerere International Airport",
    "city": "Dar es Salaam",
    "country": "TZ"
  },
  {
    "code": "DAT",
    "name": "Datong Yungang International Airport",
    "city": "Datong",
    "country": "CN"
  },
  {
    "code": "DAU",
    "name": "Daru Airport",
    "city": "Daru",
    "country": "PG"
  },
  {
    "code": "DAV",
    "name": "Enrique Malek International Airport",
    "city": "David",
    "country": "PA"
  },
  {
    "code": "DAY",
    "name": "James M. Cox Dayton International Airport",
    "city": "Dayton",
    "country": "US"
  },
  {
    "code": "DBB",
    "name": "El Alamein International Airport",
    "city": "El Alamein",
    "country": "EG"
  },
  {
    "code": "DBC",
    "name": "Baicheng Chang'an Airport",
    "city": "Baicheng",
    "country": "CN"
  },
  {
    "code": "DBD",
    "name": "Dhanbad Airport",
    "city": null,
    "country": "IN"
  },
  {
    "code": "DBO",
    "name": "Dubbo City Regional Airport",
    "city": "Dubbo",
    "country": "AU"
  },
  {
    "code": "DBQ",
    "name": "Dubuque Regional Airport",
    "city": "Dubuque",
    "country": "US"
  },
  {
    "code": "DBR",
    "name": "Darbhanga Airport",
    "city": "Darbhanga",
    "country": "IN"
  },
  {
    "code": "DBV",
    "name": "Dubrovnik Ruđer Bošković Airport",
    "city": "Dubrovnik",
    "country": "HR"
  },
  {
    "code": "DCA",
    "name": "Ronald Reagan Washington National Airport",
    "city": "Washington",
    "country": "US"
  },
  {
    "code": "DCF",
    "name": "Canefield Airport",
    "city": "Canefield",
    "country": "DM"
  },
  {
    "code": "DCI",
    "name": "Decimomannu Air Base",
    "city": "Decimomannu",
    "country": "IT"
  },
  {
    "code": "DCM",
    "name": "Castres Mazamet Airport",
    "city": "Castres",
    "country": "FR"
  },
  {
    "code": "DCN",
    "name": "RAAF Base Curtin",
    "city": "Derby",
    "country": "AU"
  },
  {
    "code": "DCT",
    "name": "Duncan Town Airport",
    "city": "Duncan Town",
    "country": "BS"
  },
  {
    "code": "DCY",
    "name": "Daocheng Yading Airport",
    "city": "Garzê (Daocheng)",
    "country": "CN"
  },
  {
    "code": "DDC",
    "name": "Dodge City Regional Airport",
    "city": "Dodge City",
    "country": "US"
  },
  {
    "code": "DDG",
    "name": "Dandong Langtou International Airport",
    "city": "Dandong (Zhenxing)",
    "country": "CN"
  },
  {
    "code": "DDR",
    "name": "Rikaze Dingri Airport",
    "city": "Xigazê (Dingri)",
    "country": "CN"
  },
  {
    "code": "DEA",
    "name": "Dera Ghazi Khan Airport",
    "city": "Dera Ghazi Khan",
    "country": "PK"
  },
  {
    "code": "DEB",
    "name": "Debrecen International Airport",
    "city": "Debrecen",
    "country": "HU"
  },
  {
    "code": "DEC",
    "name": "Decatur Airport",
    "city": "Decatur",
    "country": "US"
  },
  {
    "code": "DED",
    "name": "Dehradun Jolly Grant Airport",
    "city": "Dehradun (Jauligrant)",
    "country": "IN"
  },
  {
    "code": "DEF",
    "name": "Dezful Airport",
    "city": "Dezful",
    "country": "IR"
  },
  {
    "code": "DEJ",
    "name": "Tongren Dejiang Airport (Under Construction)",
    "city": "Tongren",
    "country": "CN"
  },
  {
    "code": "DEL",
    "name": "Indira Gandhi International Airport",
    "city": "New Delhi",
    "country": "IN"
  },
  {
    "code": "DEN",
    "name": "Denver International Airport",
    "city": "Denver",
    "country": "US"
  },
  {
    "code": "DET",
    "name": "Coleman A. Young Municipal Airport",
    "city": "Detroit",
    "country": "US"
  },
  {
    "code": "DEZ",
    "name": "Deir ez-Zor Airport",
    "city": "Deir ez-Zor",
    "country": "SY"
  },
  {
    "code": "DFW",
    "name": "Dallas Fort Worth International Airport",
    "city": "Dallas-Fort Worth",
    "country": "US"
  },
  {
    "code": "DGA",
    "name": "Dangriga Airport",
    "city": "Dangriga",
    "country": "BZ"
  },
  {
    "code": "DGE",
    "name": "Mudgee Airport",
    "city": "Mudgee",
    "country": "AU"
  },
  {
    "code": "DGO",
    "name": "General Guadalupe Victoria International Airport",
    "city": "Durango",
    "country": "MX"
  },
  {
    "code": "DGT",
    "name": "Sibulan Airport",
    "city": "Dumaguete City",
    "country": "PH"
  },
  {
    "code": "DHA",
    "name": "King Abdulaziz Air Base",
    "city": "Dhahran",
    "country": "SA"
  },
  {
    "code": "DHF",
    "name": "Al Dhafra Air Base",
    "city": null,
    "country": "AE"
  },
  {
    "code": "DHM",
    "name": "Kangra Airport",
    "city": "Kangra",
    "country": "IN"
  },
  {
    "code": "DHN",
    "name": "Dothan Regional Airport",
    "city": "Dothan",
    "country": "US"
  },
  {
    "code": "DHR",
    "name": "De Kooy Airfield / Den Helder Naval Air Station",
    "city": "Den Helder",
    "country": "NL"
  },
  {
    "code": "DHT",
    "name": "Dalhart Municipal Airport",
    "city": "Dalhart",
    "country": "US"
  },
  {
    "code": "DHX",
    "name": "Dhoho International Airport",
    "city": "Kediri",
    "country": "ID"
  },
  {
    "code": "DIA",
    "name": "Doha International Airport",
    "city": "Doha",
    "country": "QA"
  },
  {
    "code": "DIB",
    "name": "Dibrugarh Airport",
    "city": "Dibrugarh",
    "country": "IN"
  },
  {
    "code": "DIE",
    "name": "Arrachart Airport",
    "city": "Antisiranana",
    "country": "MG"
  },
  {
    "code": "DIG",
    "name": "Diqing Shangri-La Airport",
    "city": "Diqing (Shangri-La)",
    "country": "CN"
  },
  {
    "code": "DIJ",
    "name": "Dijon Longvic airport",
    "city": "Dijon",
    "country": "FR"
  },
  {
    "code": "DIK",
    "name": "Dickinson Theodore Roosevelt Regional Airport",
    "city": "Dickinson",
    "country": "US"
  },
  {
    "code": "DIL",
    "name": "Presidente Nicolau Lobato International Airport",
    "city": "Dili",
    "country": "TL"
  },
  {
    "code": "DIN",
    "name": "Dien Bien Phu Airport",
    "city": "Dien Bien Phu",
    "country": "VN"
  },
  {
    "code": "DIR",
    "name": "Aba Tenna Dejazmach Yilma International Airport",
    "city": "Dire Dawa",
    "country": "ET"
  },
  {
    "code": "DIS",
    "name": "Ngot Nzoungou Airport",
    "city": "Dolisie",
    "country": "CG"
  },
  {
    "code": "DIY",
    "name": "Diyarbakır Airport",
    "city": "Diyarbakır",
    "country": "TR"
  },
  {
    "code": "DJE",
    "name": "Djerba Zarzis International Airport",
    "city": "Mellita",
    "country": "TN"
  },
  {
    "code": "DJG",
    "name": "Djanet Inedbirene Airport",
    "city": "Djanet",
    "country": "DZ"
  },
  {
    "code": "DJJ",
    "name": "Dortheys Hiyo Eluay International Airport",
    "city": "Sentani",
    "country": "ID"
  },
  {
    "code": "DJO",
    "name": "Daloa Airport",
    "city": null,
    "country": "CI"
  },
  {
    "code": "DKA",
    "name": "Umaru Musa Yar'adua Airport",
    "city": "Katsina",
    "country": "NG"
  },
  {
    "code": "DKR",
    "name": "Léopold Sédar Senghor International Airport",
    "city": "Dakar",
    "country": "SN"
  },
  {
    "code": "DKS",
    "name": "Dikson Airport",
    "city": "Dikson",
    "country": "RU"
  },
  {
    "code": "DLA",
    "name": "Douala International Airport",
    "city": "Douala",
    "country": "CM"
  },
  {
    "code": "DLC",
    "name": "Dalian Zhoushuizi International Airport",
    "city": "Dalian (Ganjingzi)",
    "country": "CN"
  },
  {
    "code": "DLE",
    "name": "Dole Tavaux Airport",
    "city": "Dole",
    "country": "FR"
  },
  {
    "code": "DLF",
    "name": "Laughlin Air Force Base",
    "city": "Del Rio",
    "country": "US"
  },
  {
    "code": "DLG",
    "name": "Dillingham Airport",
    "city": "Dillingham",
    "country": "US"
  },
  {
    "code": "DLH",
    "name": "Duluth International Airport",
    "city": "Duluth",
    "country": "US"
  },
  {
    "code": "DLI",
    "name": "Lien Khuong Airport",
    "city": "Da Lat",
    "country": "VN"
  },
  {
    "code": "DLM",
    "name": "Dalaman International Airport",
    "city": "Dalaman",
    "country": "TR"
  },
  {
    "code": "DLS",
    "name": "Columbia Gorge Regional Airport",
    "city": "Dallesport / The Dalles",
    "country": "US"
  },
  {
    "code": "DLU",
    "name": "Dali Fengyi Airport",
    "city": "Dali (Xiaguan)",
    "country": "CN"
  },
  {
    "code": "DLZ",
    "name": "Dalanzadgad Airport",
    "city": "Dalanzadgad",
    "country": "MN"
  },
  {
    "code": "DMA",
    "name": "Davis Monthan Air Force Base",
    "city": "Tucson",
    "country": "US"
  },
  {
    "code": "DMB",
    "name": "Taraz International Airport",
    "city": "Taraz",
    "country": "KZ"
  },
  {
    "code": "DME",
    "name": "Domodedovo International Airport",
    "city": "Moscow",
    "country": "RU"
  },
  {
    "code": "DMK",
    "name": "Don Mueang International Airport",
    "city": "Bangkok",
    "country": "TH"
  },
  {
    "code": "DMM",
    "name": "King Fahd International Airport",
    "city": "Ad Dammam",
    "country": "SA"
  },
  {
    "code": "DMN",
    "name": "Deming Municipal Airport",
    "city": "Deming",
    "country": "US"
  },
  {
    "code": "DMU",
    "name": "Dimapur Airport",
    "city": "Dimapur",
    "country": "IN"
  },
  {
    "code": "DNA",
    "name": "Kadena Air Base",
    "city": "Okinawa",
    "country": "JP"
  },
  {
    "code": "DND",
    "name": "Dundee Airport",
    "city": "Dundee",
    "country": "GB"
  },
  {
    "code": "DNH",
    "name": "Dunhuang Mogao International Airport",
    "city": "Dunhuang",
    "country": "CN"
  },
  {
    "code": "DNK",
    "name": "Dnipro International Airport",
    "city": "Dnipro",
    "country": "UA"
  },
  {
    "code": "DNL",
    "name": "Daniel Field",
    "city": "Augusta",
    "country": "US"
  },
  {
    "code": "DNQ",
    "name": "Deniliquin Airport",
    "city": "Deniliquin",
    "country": "AU"
  },
  {
    "code": "DNR",
    "name": "Dinard Pleurtuit Saint-Malo airport",
    "city": "Dinard",
    "country": "FR"
  },
  {
    "code": "DNZ",
    "name": "Çardak Airport",
    "city": "Denizli",
    "country": "TR"
  },
  {
    "code": "DOD",
    "name": "Dodoma Airport",
    "city": "Dodoma",
    "country": "TZ"
  },
  {
    "code": "DOG",
    "name": "Dongola Airport",
    "city": "Dongola",
    "country": "SD"
  },
  {
    "code": "DOH",
    "name": "Hamad International Airport",
    "city": "Doha",
    "country": "QA"
  },
  {
    "code": "DOL",
    "name": "Deauville Normandie airport",
    "city": "Deauville",
    "country": "FR"
  },
  {
    "code": "DOM",
    "name": "Douglas-Charles Airport",
    "city": "Marigot",
    "country": "DM"
  },
  {
    "code": "DOV",
    "name": "Dover Civil Air Terminal/Dover Air Force Base",
    "city": "Dover",
    "country": "US"
  },
  {
    "code": "DOY",
    "name": "Dongying Shengli Airport",
    "city": "Dongying (Kenli)",
    "country": "CN"
  },
  {
    "code": "DPA",
    "name": "Dupage Airport",
    "city": "Chicago/West Chicago",
    "country": "US"
  },
  {
    "code": "DPL",
    "name": "Dipolog Airport",
    "city": "Dipolog",
    "country": "PH"
  },
  {
    "code": "DPO",
    "name": "Devonport Airport",
    "city": "Devonport",
    "country": "AU"
  },
  {
    "code": "DPS",
    "name": "Denpasar I Gusti Ngurah Rai International Airport",
    "city": "Kuta, Badung",
    "country": "ID"
  },
  {
    "code": "DQM",
    "name": "Duqm International Airport",
    "city": "Duqm",
    "country": "OM"
  },
  {
    "code": "DRA",
    "name": "Desert Rock Airport",
    "city": "Mercury",
    "country": "US"
  },
  {
    "code": "DRB",
    "name": "Derby Airport",
    "city": "Derby",
    "country": "AU"
  },
  {
    "code": "DRG",
    "name": "Deering Airport",
    "city": "Deering",
    "country": "US"
  },
  {
    "code": "DRI",
    "name": "Beauregard Regional Airport",
    "city": "DeRidder",
    "country": "US"
  },
  {
    "code": "DRN",
    "name": "Dirranbandi Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "DRO",
    "name": "Durango La Plata County Airport",
    "city": "Durango",
    "country": "US"
  },
  {
    "code": "DRP",
    "name": "Bicol International Airport",
    "city": "Legazpi",
    "country": "PH"
  },
  {
    "code": "DRS",
    "name": "Dresden Airport",
    "city": "Dresden",
    "country": "DE"
  },
  {
    "code": "DRT",
    "name": "Del Rio International Airport",
    "city": "Del Rio",
    "country": "US"
  },
  {
    "code": "DRW",
    "name": "Darwin International Airport / RAAF Darwin",
    "city": "Darwin",
    "country": "AU"
  },
  {
    "code": "DSI",
    "name": "Destin Executive Airport",
    "city": "Destin",
    "country": "US"
  },
  {
    "code": "DSK",
    "name": "Dera Ismael Khan Airport [IN-ACTIVE]",
    "city": "Dera Ismael Khan",
    "country": "PK"
  },
  {
    "code": "DSM",
    "name": "Des Moines International Airport",
    "city": "Des Moines",
    "country": "US"
  },
  {
    "code": "DSN",
    "name": "Ordos Ejin Horo Airport",
    "city": "Ordos",
    "country": "CN"
  },
  {
    "code": "DSO",
    "name": "Sondok Airport",
    "city": "Sŏndŏng-ni",
    "country": "KP"
  },
  {
    "code": "DSS",
    "name": "Blaise Diagne International Airport",
    "city": "Dakar",
    "country": "SN"
  },
  {
    "code": "DTE",
    "name": "Daet Airport",
    "city": "Daet",
    "country": "PH"
  },
  {
    "code": "DTM",
    "name": "Dortmund Airport",
    "city": "Dortmund",
    "country": "DE"
  },
  {
    "code": "DTU",
    "name": "Wudalianchi Dedu Airport",
    "city": "Heihe",
    "country": "CN"
  },
  {
    "code": "DTW",
    "name": "Detroit Metropolitan Wayne County Airport",
    "city": "Detroit",
    "country": "US"
  },
  {
    "code": "DUA",
    "name": "Durant Regional Airport - Eaker Field",
    "city": "Durant",
    "country": "US"
  },
  {
    "code": "DUB",
    "name": "Dublin Airport",
    "city": "Dublin",
    "country": "IE"
  },
  {
    "code": "DUD",
    "name": "Dunedin International Airport",
    "city": "Dunedin",
    "country": "NZ"
  },
  {
    "code": "DUE",
    "name": "Dundo Airport",
    "city": "Chitato",
    "country": "AO"
  },
  {
    "code": "DUG",
    "name": "Bisbee Douglas International Airport",
    "city": "Douglas Bisbee",
    "country": "US"
  },
  {
    "code": "DUJ",
    "name": "DuBois Regional Airport",
    "city": "Dubois",
    "country": "US"
  },
  {
    "code": "DUM",
    "name": "Pinang Kampai Airport",
    "city": "Dumai",
    "country": "ID"
  },
  {
    "code": "DUR",
    "name": "King Shaka International Airport",
    "city": "Durban",
    "country": "ZA"
  },
  {
    "code": "DUS",
    "name": "Düsseldorf Airport",
    "city": "Düsseldorf",
    "country": "DE"
  },
  {
    "code": "DUT",
    "name": "Tom Madsen (Dutch Harbor) Airport",
    "city": "Unalaska",
    "country": "US"
  },
  {
    "code": "DVL",
    "name": "Devils Lake Regional Airport",
    "city": "Devils Lake",
    "country": "US"
  },
  {
    "code": "DVO",
    "name": "Francisco Bangoy International Airport",
    "city": "Davao",
    "country": "PH"
  },
  {
    "code": "DWA",
    "name": "Dwangwa Airport",
    "city": "Dwangwa",
    "country": "MW"
  },
  {
    "code": "DWC",
    "name": "Al Maktoum International Airport",
    "city": "Dubai(Jebel Ali)",
    "country": "AE"
  },
  {
    "code": "DWD",
    "name": "Dawadmi Domestic Airport",
    "city": "Dawadmi",
    "country": "SA"
  },
  {
    "code": "DXB",
    "name": "Dubai International Airport",
    "city": "Dubai",
    "country": "AE"
  },
  {
    "code": "DXN",
    "name": "Noida International Airport",
    "city": "Gautam Buddha Nagar",
    "country": "IN"
  },
  {
    "code": "DXR",
    "name": "Danbury Municipal Airport",
    "city": "Danbury",
    "country": "US"
  },
  {
    "code": "DYA",
    "name": "Dysart Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "DYR",
    "name": "Ugolny Yuri Ryktheu Airport",
    "city": "Anadyr",
    "country": "RU"
  },
  {
    "code": "DYS",
    "name": "Dyess Air Force Base",
    "city": "Abilene",
    "country": "US"
  },
  {
    "code": "DYU",
    "name": "Dushanbe International Airport",
    "city": "Dushanbe",
    "country": "TJ"
  },
  {
    "code": "DZA",
    "name": "Dzaoudzi Pamandzi International Airport",
    "city": "Dzaoudzi",
    "country": "YT"
  },
  {
    "code": "DZH",
    "name": "Dazhou Jinya Airport",
    "city": "Dazhou (Dachuan)",
    "country": "CN"
  },
  {
    "code": "DZN",
    "name": "Zhezkazgan National Airport",
    "city": "Zhezkazgan",
    "country": "KZ"
  },
  {
    "code": "DZO",
    "name": "Santa Bernardina International Airport",
    "city": "Durazno",
    "country": "UY"
  },
  {
    "code": "EAM",
    "name": "Najran Domestic Airport",
    "city": "Najran",
    "country": "SA"
  },
  {
    "code": "EAR",
    "name": "Kearney Regional Airport",
    "city": "Kearney",
    "country": "US"
  },
  {
    "code": "EAS",
    "name": "San Sebastián Airport",
    "city": "Hondarribia",
    "country": "ES"
  },
  {
    "code": "EAT",
    "name": "Pangborn Memorial Airport",
    "city": "Wenatchee",
    "country": "US"
  },
  {
    "code": "EAU",
    "name": "Chippewa Valley Regional Airport",
    "city": "Eau Claire",
    "country": "US"
  },
  {
    "code": "EBA",
    "name": "Marina di Campo Airport",
    "city": "Campo nell'Elba (LI)",
    "country": "IT"
  },
  {
    "code": "EBB",
    "name": "Entebbe International Airport",
    "city": "Kampala",
    "country": "UG"
  },
  {
    "code": "EBD",
    "name": "El-Obeid Airport",
    "city": "El-Obeid",
    "country": "SD"
  },
  {
    "code": "EBG",
    "name": "El Bagre Airport",
    "city": "El Bagre",
    "country": "CO"
  },
  {
    "code": "EBJ",
    "name": "Esbjerg Airport",
    "city": "Esbjerg",
    "country": "DK"
  },
  {
    "code": "EBL",
    "name": "Erbil International Airport",
    "city": "Arbil",
    "country": "IQ"
  },
  {
    "code": "EBM",
    "name": "El Borma Airport",
    "city": "El Borma",
    "country": "TN"
  },
  {
    "code": "EBU",
    "name": "Saint-Étienne-Bouthéon Airport",
    "city": "Andrézieux-Bouthéon, Loire",
    "country": "FR"
  },
  {
    "code": "ECG",
    "name": "Elizabeth City Regional Airport & Coast Guard Air Station",
    "city": "Elizabeth City",
    "country": "US"
  },
  {
    "code": "ECH",
    "name": "Echuca Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "ECN",
    "name": "Ercan International Airport",
    "city": "Tymbou (Kirklar)",
    "country": "CY"
  },
  {
    "code": "ECP",
    "name": "Northwest Florida Beaches International Airport",
    "city": "Panama City Beach",
    "country": "US"
  },
  {
    "code": "EDF",
    "name": "Elmendorf Air Force Base",
    "city": "Anchorage",
    "country": "US"
  },
  {
    "code": "EDI",
    "name": "Edinburgh Airport",
    "city": "Edinburgh",
    "country": "GB"
  },
  {
    "code": "EDL",
    "name": "Eldoret International Airport",
    "city": "Eldoret",
    "country": "KE"
  },
  {
    "code": "EDM",
    "name": "La Roche-sur-Yon Les Ajoncs Airport",
    "city": "La Roche-sur-Yon",
    "country": "FR"
  },
  {
    "code": "EDO",
    "name": "Balıkesir Koca Seyit Airport",
    "city": "Edremit",
    "country": "TR"
  },
  {
    "code": "EDW",
    "name": "Edwards Air Force Base",
    "city": "Edwards",
    "country": "US"
  },
  {
    "code": "EEA",
    "name": "Planalto Serrano Regional Airport",
    "city": "Correia Pinto",
    "country": "BR"
  },
  {
    "code": "EED",
    "name": "Needles Airport",
    "city": "Needles",
    "country": "US"
  },
  {
    "code": "EEN",
    "name": "Dillant Hopkins Airport",
    "city": "Keene",
    "country": "US"
  },
  {
    "code": "EES",
    "name": "Berenice International Airport / Banas Cape Air Base",
    "city": "Berenice Troglodytica",
    "country": "EG"
  },
  {
    "code": "EFD",
    "name": "Ellington Airport",
    "city": "Houston",
    "country": "US"
  },
  {
    "code": "EFL",
    "name": "Kefallinia Airport",
    "city": "Kefallinia Island",
    "country": "GR"
  },
  {
    "code": "EGC",
    "name": "Bergerac Dordogne-Périgord airport",
    "city": "Bergerac",
    "country": "FR"
  },
  {
    "code": "EGE",
    "name": "Eagle County Regional Airport",
    "city": "Eagle",
    "country": "US"
  },
  {
    "code": "EGH",
    "name": "El Jora Airport",
    "city": "El Jora",
    "country": "EG"
  },
  {
    "code": "EGI",
    "name": "Duke Field",
    "city": "Crestview",
    "country": "US"
  },
  {
    "code": "EGO",
    "name": "Belgorod International Airport",
    "city": "Belgorod",
    "country": "RU"
  },
  {
    "code": "EGS",
    "name": "Egilsstaðir Airport",
    "city": "Egilsstaðir",
    "country": "IS"
  },
  {
    "code": "EGX",
    "name": "Egegik Airport",
    "city": "Egegik",
    "country": "US"
  },
  {
    "code": "EHL",
    "name": "El Bolsón Airfield",
    "city": "El Bolsón",
    "country": "AR"
  },
  {
    "code": "EHM",
    "name": "Cape Newenham LRRS Airport",
    "city": "Cape Newenham",
    "country": "US"
  },
  {
    "code": "EHU",
    "name": "Ezhou Huahu Airport",
    "city": "Ezhou",
    "country": "CN"
  },
  {
    "code": "EIB",
    "name": "Eisenach-Kindel Airport",
    "city": "Hörselberg-Hainich",
    "country": "DE"
  },
  {
    "code": "EIE",
    "name": "Yeniseysk Airport",
    "city": "Yeniseysk",
    "country": "RU"
  },
  {
    "code": "EIK",
    "name": "Yeysk Airport",
    "city": "Yeysk",
    "country": "RU"
  },
  {
    "code": "EIL",
    "name": "Eielson Air Force Base",
    "city": "Fairbanks",
    "country": "US"
  },
  {
    "code": "EIN",
    "name": "Eindhoven Airport",
    "city": "Eindhoven",
    "country": "NL"
  },
  {
    "code": "EIS",
    "name": "Terrance B. Lettsome International Airport",
    "city": "Beef Island",
    "country": "VG"
  },
  {
    "code": "EJA",
    "name": "Yariguíes Airport",
    "city": "Barrancabermeja",
    "country": "CO"
  },
  {
    "code": "EJH",
    "name": "Al Wajh Domestic Airport",
    "city": "Al Wajh",
    "country": "SA"
  },
  {
    "code": "EKA",
    "name": "Murray Field",
    "city": "Eureka",
    "country": "US"
  },
  {
    "code": "EKB",
    "name": "Ekibastuz Airport",
    "city": "Ekibastuz",
    "country": "KZ"
  },
  {
    "code": "EKN",
    "name": "Elkins-Randolph County Regional Airport",
    "city": "Elkins",
    "country": "US"
  },
  {
    "code": "EKO",
    "name": "Elko Regional Airport",
    "city": "Elko",
    "country": "US"
  },
  {
    "code": "EKT",
    "name": "Eskilstuna Airport",
    "city": "Eskilstuna",
    "country": "SE"
  },
  {
    "code": "ELB",
    "name": "Las Flores Airport",
    "city": "El Banco",
    "country": "CO"
  },
  {
    "code": "ELC",
    "name": "Elcho Island Airport",
    "city": "Elcho Island",
    "country": "AU"
  },
  {
    "code": "ELD",
    "name": "South Arkansas Regional Airport at Goodwin Field",
    "city": "El Dorado",
    "country": "US"
  },
  {
    "code": "ELF",
    "name": "El Fasher Airport",
    "city": "El Fasher",
    "country": "SD"
  },
  {
    "code": "ELG",
    "name": "El Golea Airport",
    "city": "El Menia",
    "country": "DZ"
  },
  {
    "code": "ELH",
    "name": "North Eleuthera Airport",
    "city": "North Eleuthera",
    "country": "BS"
  },
  {
    "code": "ELM",
    "name": "Elmira Corning Regional Airport",
    "city": "Elmira/Corning",
    "country": "US"
  },
  {
    "code": "ELP",
    "name": "El Paso International Airport",
    "city": "El Paso",
    "country": "US"
  },
  {
    "code": "ELQ",
    "name": "Gassim Airport",
    "city": "Buraidah",
    "country": "SA"
  },
  {
    "code": "ELS",
    "name": "King Phalo Airport",
    "city": "East London",
    "country": "ZA"
  },
  {
    "code": "ELU",
    "name": "Guemar Airport - مطار قمار بالوادي",
    "city": "Guemar",
    "country": "DZ"
  },
  {
    "code": "ELY",
    "name": "Ely Airport Yelland Field",
    "city": "Ely",
    "country": "US"
  },
  {
    "code": "EMA",
    "name": "East Midlands Airport",
    "city": "Nottingham",
    "country": "GB"
  },
  {
    "code": "EMD",
    "name": "Emerald Airport",
    "city": "Emerald",
    "country": "AU"
  },
  {
    "code": "EMK",
    "name": "Emmonak Airport",
    "city": "Emmonak",
    "country": "US"
  },
  {
    "code": "EML",
    "name": "Emmen Air Base",
    "city": "Emmen",
    "country": "CH"
  },
  {
    "code": "ENA",
    "name": "Kenai Municipal Airport",
    "city": "Kenai",
    "country": "US"
  },
  {
    "code": "ENC",
    "name": "Nancy-Essey Airport",
    "city": "Tomblaine, Meurthe-et-Moselle",
    "country": "FR"
  },
  {
    "code": "END",
    "name": "Vance Air Force Base",
    "city": "Enid",
    "country": "US"
  },
  {
    "code": "ENF",
    "name": "Enontekio Airport",
    "city": "Enontekio",
    "country": "FI"
  },
  {
    "code": "ENH",
    "name": "Enshi Xujiaping Airport",
    "city": "Enshi (Enshi)",
    "country": "CN"
  },
  {
    "code": "ENK",
    "name": "Enniskillen/St Angelo Airport",
    "city": "Enniskillen, Fermanagh and Omagh",
    "country": "GB"
  },
  {
    "code": "ENN",
    "name": "Nenana Municipal Airport",
    "city": "Nenana",
    "country": "US"
  },
  {
    "code": "ENO",
    "name": "Aeropuerto Internacional Tte. Amín Ayub González",
    "city": "Encarnación",
    "country": "PY"
  },
  {
    "code": "ENS",
    "name": "Twente Airport",
    "city": "Enschede",
    "country": "NL"
  },
  {
    "code": "ENU",
    "name": "Akanu Ibiam International Airport",
    "city": "Enegu",
    "country": "NG"
  },
  {
    "code": "ENV",
    "name": "Wendover Airport",
    "city": "Wendover",
    "country": "US"
  },
  {
    "code": "ENW",
    "name": "Kenosha Regional Airport",
    "city": "Kenosha",
    "country": "US"
  },
  {
    "code": "ENY",
    "name": "Yan'an Nanniwan Airport",
    "city": "Yan'an (Baota)",
    "country": "CN"
  },
  {
    "code": "EOH",
    "name": "Enrique Olaya Herrera Airport",
    "city": "Medellín",
    "country": "CO"
  },
  {
    "code": "EOI",
    "name": "Eday Airport",
    "city": "Eday",
    "country": "GB"
  },
  {
    "code": "EOR",
    "name": "El Dorado Airport",
    "city": "Bolivar",
    "country": "VE"
  },
  {
    "code": "EOZ",
    "name": "Elorza Airport",
    "city": null,
    "country": "VE"
  },
  {
    "code": "EPA",
    "name": "El Palomar Airport",
    "city": "El Palomar",
    "country": "AR"
  },
  {
    "code": "EPL",
    "name": "Épinal Mirecourt Airport",
    "city": "Épinal",
    "country": "FR"
  },
  {
    "code": "EPR",
    "name": "Esperance Airport",
    "city": "Esperance",
    "country": "AU"
  },
  {
    "code": "EPU",
    "name": "Pärnu Airport",
    "city": "Pärnu",
    "country": "EE"
  },
  {
    "code": "EQS",
    "name": "Esquel Brigadier Antonio Parodi International Airport",
    "city": "Esquel",
    "country": "AR"
  },
  {
    "code": "ERC",
    "name": "Erzincan Airport",
    "city": "Erzincan",
    "country": "TR"
  },
  {
    "code": "ERD",
    "name": "Berdyansk Airport",
    "city": "Berdyansk",
    "country": "UA"
  },
  {
    "code": "ERF",
    "name": "Erfurt-Weimar Airport",
    "city": "Erfurt",
    "country": "DE"
  },
  {
    "code": "ERH",
    "name": "Moulay Ali Cherif Airport",
    "city": "Errachidia",
    "country": "MA"
  },
  {
    "code": "ERI",
    "name": "Erie International Tom Ridge Field",
    "city": "Erie",
    "country": "US"
  },
  {
    "code": "ERL",
    "name": "Erenhot Saiwusu International Airport",
    "city": "Erenhot",
    "country": "CN"
  },
  {
    "code": "ERS",
    "name": "Eros Airport",
    "city": "Windhoek",
    "country": "NA"
  },
  {
    "code": "ERZ",
    "name": "Erzurum International Airport",
    "city": "Erzurum",
    "country": "TR"
  },
  {
    "code": "ESB",
    "name": "Esenboğa International Airport",
    "city": "Ankara",
    "country": "TR"
  },
  {
    "code": "ESC",
    "name": "Delta County Airport",
    "city": "Escanaba",
    "country": "US"
  },
  {
    "code": "ESD",
    "name": "Orcas Island Airport",
    "city": "Eastsound",
    "country": "US"
  },
  {
    "code": "ESE",
    "name": "Ensenada International Airport / El Ciprés Air Base",
    "city": "Ensenada",
    "country": "MX"
  },
  {
    "code": "ESF",
    "name": "Esler Army Airfield / Esler Regional Airport",
    "city": "Alexandria",
    "country": "US"
  },
  {
    "code": "ESG",
    "name": "Aeropuerto Internacional Dr. Luis Maria Argaña",
    "city": "Mariscal Estigarribia",
    "country": "PY"
  },
  {
    "code": "ESH",
    "name": "Brighton City Airport",
    "city": "Brighton, East Sussex",
    "country": "GB"
  },
  {
    "code": "ESK",
    "name": "Eskişehir Air Base",
    "city": "Eskişehir",
    "country": "TR"
  },
  {
    "code": "ESL",
    "name": "Elista Airport",
    "city": "Elista",
    "country": "RU"
  },
  {
    "code": "ESM",
    "name": "Carlos Concha Torres International Airport",
    "city": "Tachina",
    "country": "EC"
  },
  {
    "code": "ESR",
    "name": "Ricardo García Posada Airport",
    "city": "El Salvador",
    "country": "CL"
  },
  {
    "code": "ESU",
    "name": "Essaouira-Mogador Airport",
    "city": "Essaouira",
    "country": "MA"
  },
  {
    "code": "ETM",
    "name": "Ramon International Airport",
    "city": "Eilat",
    "country": "IL"
  },
  {
    "code": "ETR",
    "name": "Santa Rosa - Artillery Colonel Victor Larrea International Airport",
    "city": "Santa Rosa",
    "country": "EC"
  },
  {
    "code": "ETZ",
    "name": "Metz-Nancy-Lorraine Airport",
    "city": "Goin",
    "country": "FR"
  },
  {
    "code": "EUG",
    "name": "Eugene Airport",
    "city": "Eugene",
    "country": "US"
  },
  {
    "code": "EUN",
    "name": "Laayoune Hassan I International Airport",
    "city": "El Aaiún",
    "country": "EH"
  },
  {
    "code": "EUQ",
    "name": "Evelio Javier Airport",
    "city": "San Jose",
    "country": "PH"
  },
  {
    "code": "EUX",
    "name": "F. D. Roosevelt Airport",
    "city": "Oranjestad",
    "country": "BQ"
  },
  {
    "code": "EVE",
    "name": "Harstad/Narvik Airport",
    "city": "Evenes",
    "country": "NO"
  },
  {
    "code": "EVN",
    "name": "Zvartnots International Airport",
    "city": "Yerevan",
    "country": "AM"
  },
  {
    "code": "EVV",
    "name": "Evansville Regional Airport",
    "city": "Evansville",
    "country": "US"
  },
  {
    "code": "EVW",
    "name": "Evanston-Uinta County Airport-Burns Field",
    "city": "Evanston",
    "country": "US"
  },
  {
    "code": "EVX",
    "name": "Évreux-Fauville (BA 105) Air Base",
    "city": "Fauville, Eure",
    "country": "FR"
  },
  {
    "code": "EWB",
    "name": "New Bedford Regional Airport",
    "city": "New Bedford",
    "country": "US"
  },
  {
    "code": "EWN",
    "name": "Coastal Carolina Regional Airport",
    "city": "New Bern",
    "country": "US"
  },
  {
    "code": "EWR",
    "name": "Newark Liberty International Airport",
    "city": "Newark",
    "country": "US"
  },
  {
    "code": "EXT",
    "name": "Exeter International Airport",
    "city": "Exeter, Devon",
    "country": "GB"
  },
  {
    "code": "EYK",
    "name": "Beloyarskiy Airport",
    "city": null,
    "country": "RU"
  },
  {
    "code": "EYP",
    "name": "El Alcaravan - Yopal Airport",
    "city": "Yopal",
    "country": "CO"
  },
  {
    "code": "EYW",
    "name": "Key West International Airport",
    "city": "Key West",
    "country": "US"
  },
  {
    "code": "EZE",
    "name": "Ezeiza International Airport - Ministro Pistarini",
    "city": "Buenos Aires (Ezeiza)",
    "country": "AR"
  },
  {
    "code": "EZS",
    "name": "Elazığ Airport",
    "city": "Elazığ",
    "country": "TR"
  },
  {
    "code": "EZV",
    "name": "Berezovo Airport",
    "city": null,
    "country": "RU"
  },
  {
    "code": "FAB",
    "name": "Farnborough Airport",
    "city": "Farnborough, Hampshire",
    "country": "GB"
  },
  {
    "code": "FAE",
    "name": "Vágar Airport",
    "city": "Vágar",
    "country": "FO"
  },
  {
    "code": "FAF",
    "name": "Felker Army Air Field",
    "city": "Newport News (Fort Eustis)",
    "country": "US"
  },
  {
    "code": "FAI",
    "name": "Fairbanks International Airport",
    "city": "Fairbanks",
    "country": "US"
  },
  {
    "code": "FAO",
    "name": "Faro - Gago Coutinho International Airport",
    "city": "Faro",
    "country": "PT"
  },
  {
    "code": "FAR",
    "name": "Hector International Airport",
    "city": "Fargo",
    "country": "US"
  },
  {
    "code": "FAT",
    "name": "Fresno Yosemite International Airport",
    "city": "Fresno",
    "country": "US"
  },
  {
    "code": "FAV",
    "name": "Fakarava Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "FAY",
    "name": "Fayetteville Regional Airport - Grannis Field",
    "city": "Fayetteville",
    "country": "US"
  },
  {
    "code": "FAZ",
    "name": "Fasa Airport",
    "city": "Fasa",
    "country": "IR"
  },
  {
    "code": "FBG",
    "name": "Simmons Army Air Field",
    "city": "Fort Bragg",
    "country": "US"
  },
  {
    "code": "FBK",
    "name": "Ladd Army Airfield",
    "city": "Fairbanks",
    "country": "US"
  },
  {
    "code": "FBM",
    "name": "Lubumbashi International Airport",
    "city": "Lubumbashi",
    "country": "CD"
  },
  {
    "code": "FCA",
    "name": "Glacier Park International Airport",
    "city": "Kalispell",
    "country": "US"
  },
  {
    "code": "FCB",
    "name": "Ficksburg Sentraoes Airport",
    "city": "Ficksburg",
    "country": "ZA"
  },
  {
    "code": "FCN",
    "name": "Sea-Airport Cuxhaven/Nordholz / Nordholz Naval Airbase",
    "city": "Wurster Nordseeküste",
    "country": "DE"
  },
  {
    "code": "FCO",
    "name": "Rome–Fiumicino Leonardo da Vinci International Airport",
    "city": "Rome",
    "country": "IT"
  },
  {
    "code": "FCS",
    "name": "Butts AAF (Fort Carson) Air Field",
    "city": "Fort Carson",
    "country": "US"
  },
  {
    "code": "FDF",
    "name": "Martinique Aimé Césaire International Airport",
    "city": "Fort-de-France",
    "country": "MQ"
  },
  {
    "code": "FDH",
    "name": "Bodensee Airport Friedrichshafen",
    "city": "Friedrichshafen",
    "country": "DE"
  },
  {
    "code": "FDU",
    "name": "Bandundu Airport",
    "city": "Bandundu",
    "country": "CD"
  },
  {
    "code": "FDY",
    "name": "Findlay Airport",
    "city": "Findlay",
    "country": "US"
  },
  {
    "code": "FEC",
    "name": "João Durval Carneiro Airport",
    "city": "Feira de Santana",
    "country": "BR"
  },
  {
    "code": "FEG",
    "name": "Fergana International Airport",
    "city": "Fergana",
    "country": "UZ"
  },
  {
    "code": "FEN",
    "name": "Fernando de Noronha Airport",
    "city": "Fernando de Noronha",
    "country": "BR"
  },
  {
    "code": "FEZ",
    "name": "Fes Saïss International Airport",
    "city": "Saïss",
    "country": "MA"
  },
  {
    "code": "FFD",
    "name": "RAF Fairford",
    "city": "Fairford, Gloucestershire",
    "country": "GB"
  },
  {
    "code": "FFO",
    "name": "Wright-Patterson Air Force Base",
    "city": "Dayton",
    "country": "US"
  },
  {
    "code": "FGU",
    "name": "Fangatau Airport",
    "city": "Fangatau",
    "country": "PF"
  },
  {
    "code": "FHU",
    "name": "Sierra Vista Municipal Airport / Libby Army Air Field",
    "city": "Fort Huachuca / Sierra Vista",
    "country": "US"
  },
  {
    "code": "FIH",
    "name": "Ndjili International Airport",
    "city": "Kinshasa",
    "country": "CD"
  },
  {
    "code": "FIZ",
    "name": "Fitzroy Crossing Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "FJR",
    "name": "Fujairah International Airport",
    "city": "Fujairah",
    "country": "AE"
  },
  {
    "code": "FKB",
    "name": "Karlsruhe Baden-Baden Airport",
    "city": "Rheinmünster",
    "country": "DE"
  },
  {
    "code": "FKI",
    "name": "Bangoka International Airport",
    "city": "Kisangani",
    "country": "CD"
  },
  {
    "code": "FKJ",
    "name": "Fukui Airport",
    "city": "Fukui",
    "country": "JP"
  },
  {
    "code": "FKL",
    "name": "Venango Regional Airport",
    "city": "Franklin",
    "country": "US"
  },
  {
    "code": "FKQ",
    "name": "Fakfak Airport",
    "city": "Fakfak",
    "country": "ID"
  },
  {
    "code": "FKS",
    "name": "Fukushima Airport",
    "city": "Sukagawa",
    "country": "JP"
  },
  {
    "code": "FLA",
    "name": "Gustavo Artunduaga Paredes Airport",
    "city": "Florencia",
    "country": "CO"
  },
  {
    "code": "FLG",
    "name": "Flagstaff Pulliam Airport",
    "city": "Flagstaff",
    "country": "US"
  },
  {
    "code": "FLL",
    "name": "Fort Lauderdale Hollywood International Airport",
    "city": "Fort Lauderdale",
    "country": "US"
  },
  {
    "code": "FLN",
    "name": "Hercílio Luz International Airport",
    "city": "Florianópolis",
    "country": "BR"
  },
  {
    "code": "FLO",
    "name": "Florence Regional Airport",
    "city": "Florence",
    "country": "US"
  },
  {
    "code": "FLR",
    "name": "Florence Airport, Peretola",
    "city": "Firenze (FI)",
    "country": "IT"
  },
  {
    "code": "FLW",
    "name": "Flores Airport",
    "city": "Santa Cruz das Flores",
    "country": "PT"
  },
  {
    "code": "FLZ",
    "name": "Dr. Ferdinand Lumban Tobing Airport",
    "city": "Sibolga (Pinangsori)",
    "country": "ID"
  },
  {
    "code": "FMA",
    "name": "Formosa National Airport",
    "city": "Formosa",
    "country": "AR"
  },
  {
    "code": "FME",
    "name": "Fort Meade Executive Airport",
    "city": "Fort Meade(Odenton)",
    "country": "US"
  },
  {
    "code": "FMI",
    "name": "Kalemie Airport",
    "city": "Kalemie",
    "country": "CD"
  },
  {
    "code": "FMM",
    "name": "Memmingen Allgau Airport",
    "city": "Memmingen",
    "country": "DE"
  },
  {
    "code": "FMN",
    "name": "Four Corners Regional Airport",
    "city": "Farmington",
    "country": "US"
  },
  {
    "code": "FMO",
    "name": "Münster Osnabrück Airport",
    "city": "Greven",
    "country": "DE"
  },
  {
    "code": "FMY",
    "name": "Page Field",
    "city": "Fort Myers",
    "country": "US"
  },
  {
    "code": "FNA",
    "name": "Lungi International Airport",
    "city": "Freetown (Lungi-Town)",
    "country": "SL"
  },
  {
    "code": "FNB",
    "name": "Neubrandenburg Trollenhagen Airport",
    "city": "Trollenhagen",
    "country": "DE"
  },
  {
    "code": "FNC",
    "name": "Cristiano Ronaldo International Airport",
    "city": "Funchal",
    "country": "PT"
  },
  {
    "code": "FNI",
    "name": "Nîmes-Arles-Camargue Airport",
    "city": "Nîmes/Garons",
    "country": "FR"
  },
  {
    "code": "FNJ",
    "name": "Pyongyang Sunan International Airport",
    "city": "Pyongyang",
    "country": "KP"
  },
  {
    "code": "FNL",
    "name": "Northern Colorado Regional Airport",
    "city": "Loveland",
    "country": "US"
  },
  {
    "code": "FNT",
    "name": "Bishop International Airport",
    "city": "Flint",
    "country": "US"
  },
  {
    "code": "FOC",
    "name": "Fuzhou Changle International Airport",
    "city": "Fuzhou (Changle)",
    "country": "CN"
  },
  {
    "code": "FOD",
    "name": "Fort Dodge Regional Airport",
    "city": "Fort Dodge",
    "country": "US"
  },
  {
    "code": "FOE",
    "name": "Topeka Regional Airport",
    "city": "Topeka",
    "country": "US"
  },
  {
    "code": "FOG",
    "name": "Foggia Gino Lisa Airport",
    "city": "Foggia (FG)",
    "country": "IT"
  },
  {
    "code": "FOM",
    "name": "Foumban Nkounja Airport",
    "city": "Foumban",
    "country": "CM"
  },
  {
    "code": "FOR",
    "name": "Pinto Martins International Airport",
    "city": "Fortaleza",
    "country": "BR"
  },
  {
    "code": "FOS",
    "name": "Forrest Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "FPO",
    "name": "Grand Bahama International Airport",
    "city": "Freeport",
    "country": "BS"
  },
  {
    "code": "FPR",
    "name": "Treasure Coast International Airport",
    "city": "Fort Pierce",
    "country": "US"
  },
  {
    "code": "FRA",
    "name": "Frankfurt Airport",
    "city": "Frankfurt am Main",
    "country": "DE"
  },
  {
    "code": "FRB",
    "name": "Forbes Airport",
    "city": "Forbes",
    "country": "AU"
  },
  {
    "code": "FRD",
    "name": "Friday Harbor Airport",
    "city": "Friday Harbor",
    "country": "US"
  },
  {
    "code": "FRG",
    "name": "Republic Airport",
    "city": "East Farmingdale",
    "country": "US"
  },
  {
    "code": "FRI",
    "name": "Marshall Army Air Field",
    "city": "Fort Riley (Junction City)",
    "country": "US"
  },
  {
    "code": "FRL",
    "name": "Forlì-Luigi Ridolfi International Airport",
    "city": "Forlì (FC)",
    "country": "IT"
  },
  {
    "code": "FRO",
    "name": "Florø Airport",
    "city": "Florø",
    "country": "NO"
  },
  {
    "code": "FRS",
    "name": "Mundo Maya International Airport",
    "city": "San Benito",
    "country": "GT"
  },
  {
    "code": "FRW",
    "name": "Phillip Gaonwe Matante International Airport",
    "city": "Francistown",
    "country": "BW"
  },
  {
    "code": "FRZ",
    "name": "Fritzlar Army Airfield",
    "city": "Fritzlar",
    "country": "DE"
  },
  {
    "code": "FSC",
    "name": "Figari Sud-Corse Airport",
    "city": "Figari",
    "country": "FR"
  },
  {
    "code": "FSD",
    "name": "Sioux Falls Regional Airport",
    "city": "Sioux Falls",
    "country": "US"
  },
  {
    "code": "FSI",
    "name": "Henry Post Army Air Field",
    "city": "Fort Sill",
    "country": "US"
  },
  {
    "code": "FSM",
    "name": "Fort Smith Regional Airport",
    "city": "Fort Smith",
    "country": "US"
  },
  {
    "code": "FSP",
    "name": "Saint-Pierre Pointe-Blanche Airport",
    "city": "Saint-Pierre",
    "country": "PM"
  },
  {
    "code": "FST",
    "name": "Fort Stockton Pecos County Airport",
    "city": "Fort Stockton",
    "country": "US"
  },
  {
    "code": "FSZ",
    "name": "Mount Fuji Shizuoka Airport",
    "city": "Makinohara / Shimada",
    "country": "JP"
  },
  {
    "code": "FTE",
    "name": "El Calafate - Commander Armando Tola International Airport",
    "city": "El Calafate",
    "country": "AR"
  },
  {
    "code": "FTK",
    "name": "Godman Army Air Field",
    "city": "Fort Knox",
    "country": "US"
  },
  {
    "code": "FTU",
    "name": "Tôlanaro Airport",
    "city": "Tôlanaro",
    "country": "MG"
  },
  {
    "code": "FTW",
    "name": "Fort Worth Meacham International Airport",
    "city": "Fort Worth",
    "country": "US"
  },
  {
    "code": "FTX",
    "name": "Owando Airport",
    "city": "Owando",
    "country": "CG"
  },
  {
    "code": "FTY",
    "name": "Fulton County Airport Brown Field",
    "city": "Atlanta",
    "country": "US"
  },
  {
    "code": "FUE",
    "name": "Fuerteventura Airport",
    "city": "El Matorral",
    "country": "ES"
  },
  {
    "code": "FUG",
    "name": "Fuyang Xiguan Airport",
    "city": "Yingzhou, Fuyang",
    "country": "CN"
  },
  {
    "code": "FUJ",
    "name": "Fukue Airport",
    "city": "Goto",
    "country": "JP"
  },
  {
    "code": "FUK",
    "name": "Fukuoka Airport",
    "city": "Fukuoka",
    "country": "JP"
  },
  {
    "code": "FUN",
    "name": "Funafuti International Airport",
    "city": "Funafuti",
    "country": "TV"
  },
  {
    "code": "FUO",
    "name": "Foshan Shadi Airport",
    "city": "Foshan (Nanhai)",
    "country": "CN"
  },
  {
    "code": "FWA",
    "name": "Fort Wayne International Airport",
    "city": "Fort Wayne",
    "country": "US"
  },
  {
    "code": "FWH",
    "name": "NAS Fort Worth JRB / Carswell Field",
    "city": "Fort Worth",
    "country": "US"
  },
  {
    "code": "FXE",
    "name": "Fort Lauderdale Executive Airport",
    "city": "Fort Lauderdale",
    "country": "US"
  },
  {
    "code": "FYJ",
    "name": "Fuyuan Dongji Airport",
    "city": "Fuyuan",
    "country": "CN"
  },
  {
    "code": "FYN",
    "name": "Fuyun Koktokay Airport",
    "city": "Fuyun",
    "country": "CN"
  },
  {
    "code": "FYT",
    "name": "Faya-Largeau Airport",
    "city": "Faya-Largeau",
    "country": "TD"
  },
  {
    "code": "FYU",
    "name": "Fort Yukon Airport",
    "city": "Fort Yukon",
    "country": "US"
  },
  {
    "code": "FYV",
    "name": "Drake Field",
    "city": "Fayetteville",
    "country": "US"
  },
  {
    "code": "GAE",
    "name": "Gabès Matmata International Airport",
    "city": "Gabès",
    "country": "TN"
  },
  {
    "code": "GAF",
    "name": "Gafsa Ksar International Airport",
    "city": "Gafsa",
    "country": "TN"
  },
  {
    "code": "GAJ",
    "name": "Yamagata Airport",
    "city": "Higashine",
    "country": "JP"
  },
  {
    "code": "GAL",
    "name": "Edward G. Pitka Sr Airport",
    "city": "Galena",
    "country": "US"
  },
  {
    "code": "GAM",
    "name": "Gambell Airport",
    "city": "Gambell",
    "country": "US"
  },
  {
    "code": "GAN",
    "name": "Gan International Airport",
    "city": "Gan",
    "country": "MV"
  },
  {
    "code": "GAO",
    "name": "Mariana Grajales Airport",
    "city": "Guantánamo",
    "country": "CU"
  },
  {
    "code": "GAQ",
    "name": "Gao International Airport",
    "city": "Gao",
    "country": "ML"
  },
  {
    "code": "GAU",
    "name": "Lokpriya Gopinath Bordoloi International Airport",
    "city": "Guwahati",
    "country": "IN"
  },
  {
    "code": "GAY",
    "name": "Gaya Airport",
    "city": "Gaya",
    "country": "IN"
  },
  {
    "code": "GBB",
    "name": "Gabala International Airport",
    "city": "Gabala",
    "country": "AZ"
  },
  {
    "code": "GBE",
    "name": "Sir Seretse Khama International Airport",
    "city": "Gaborone",
    "country": "BW"
  },
  {
    "code": "GBJ",
    "name": "Marie-Galante Airport",
    "city": "Grand-Bourg",
    "country": "GP"
  },
  {
    "code": "GBT",
    "name": "Gorgan Airport",
    "city": "Gorgan",
    "country": "IR"
  },
  {
    "code": "GCC",
    "name": "Northeast Wyoming Regional Airport",
    "city": "Gillette",
    "country": "US"
  },
  {
    "code": "GCH",
    "name": "Gachsaran Airport",
    "city": "Gachsaran",
    "country": "IR"
  },
  {
    "code": "GCI",
    "name": "Guernsey Airport",
    "city": "Saint Peter Port",
    "country": "GG"
  },
  {
    "code": "GCJ",
    "name": "Grand Central Airport",
    "city": "Midrand",
    "country": "ZA"
  },
  {
    "code": "GCK",
    "name": "Garden City Regional Airport",
    "city": "Garden City",
    "country": "US"
  },
  {
    "code": "GCM",
    "name": "Owen Roberts International Airport",
    "city": "George Town",
    "country": "KY"
  },
  {
    "code": "GCN",
    "name": "Grand Canyon National Park Airport",
    "city": "Grand Canyon - Tusayan",
    "country": "US"
  },
  {
    "code": "GDB",
    "name": "Gondia Airport",
    "city": "Gondia",
    "country": "IN"
  },
  {
    "code": "GDE",
    "name": "Gode Airport",
    "city": "Gode",
    "country": "ET"
  },
  {
    "code": "GDL",
    "name": "Guadalajara International Airport",
    "city": "Guadalajara",
    "country": "MX"
  },
  {
    "code": "GDN",
    "name": "Gdańsk Lech Wałęsa Airport",
    "city": "Gdańsk",
    "country": "PL"
  },
  {
    "code": "GDO",
    "name": "Guasdualito Airport",
    "city": "Guasdualito",
    "country": "VE"
  },
  {
    "code": "GDQ",
    "name": "Gondar Airport",
    "city": "Azezo",
    "country": "ET"
  },
  {
    "code": "GDT",
    "name": "JAGS McCartney International Airport",
    "city": "Cockburn Town",
    "country": "TC"
  },
  {
    "code": "GDV",
    "name": "Dawson Community Airport",
    "city": "Glendive",
    "country": "US"
  },
  {
    "code": "GDX",
    "name": "Sokol Airport",
    "city": "Magadan",
    "country": "RU"
  },
  {
    "code": "GDZ",
    "name": "Gelendzhik Airport",
    "city": "Gelendzhik",
    "country": "RU"
  },
  {
    "code": "GEA",
    "name": "Nouméa Magenta Airport",
    "city": "Nouméa",
    "country": "NC"
  },
  {
    "code": "GEC",
    "name": "Lefkoniko Airport / Geçitkale Air Base",
    "city": "Lefkoniko (Geçitkale)",
    "country": "CY"
  },
  {
    "code": "GEG",
    "name": "Spokane International Airport",
    "city": "Spokane",
    "country": "US"
  },
  {
    "code": "GEL",
    "name": "Santo Ângelo Airport",
    "city": "Santo Ângelo",
    "country": "BR"
  },
  {
    "code": "GEM",
    "name": "President Obiang Nguema International Airport",
    "city": "Mengomeyén",
    "country": "GQ"
  },
  {
    "code": "GEO",
    "name": "Cheddi Jagan International Airport",
    "city": "Georgetown",
    "country": "GY"
  },
  {
    "code": "GER",
    "name": "Rafael Cabrera Airport",
    "city": "Nueva Gerona",
    "country": "CU"
  },
  {
    "code": "GES",
    "name": "General Santos International Airport",
    "city": "General Santos",
    "country": "PH"
  },
  {
    "code": "GET",
    "name": "Geraldton Airport",
    "city": "Moonyoonooka",
    "country": "AU"
  },
  {
    "code": "GEV",
    "name": "Gällivare Airport",
    "city": "Gällivare",
    "country": "SE"
  },
  {
    "code": "GFF",
    "name": "Griffith Airport",
    "city": "Griffith",
    "country": "AU"
  },
  {
    "code": "GFK",
    "name": "Grand Forks International Airport",
    "city": "Grand Forks",
    "country": "US"
  },
  {
    "code": "GFL",
    "name": "Floyd Bennett Memorial Airport",
    "city": "Glens Falls",
    "country": "US"
  },
  {
    "code": "GFN",
    "name": "Clarence Valley Regional Airport",
    "city": "Grafton",
    "country": "AU"
  },
  {
    "code": "GFR",
    "name": "Granville Airport",
    "city": "Bréville-sur-Mer, Manche",
    "country": "FR"
  },
  {
    "code": "GFY",
    "name": "Grootfontein Airport",
    "city": "Grootfontein",
    "country": "NA"
  },
  {
    "code": "GGG",
    "name": "East Texas Regional Airport",
    "city": "Longview",
    "country": "US"
  },
  {
    "code": "GGT",
    "name": "Exuma International Airport",
    "city": "Moss Town",
    "country": "BS"
  },
  {
    "code": "GGW",
    "name": "Glasgow Valley County Airport Wokal Field",
    "city": "Glasgow",
    "country": "US"
  },
  {
    "code": "GHA",
    "name": "Noumérat - Moufdi Zakaria Airport",
    "city": "El Atteuf",
    "country": "DZ"
  },
  {
    "code": "GHB",
    "name": "Governor's Harbour Airport",
    "city": "Governor's Harbour",
    "country": "BS"
  },
  {
    "code": "GHC",
    "name": "Great Harbour Cay Airport",
    "city": "Bullocks Harbour",
    "country": "BS"
  },
  {
    "code": "GHT",
    "name": "Ghat Airport",
    "city": "Ghat",
    "country": "LY"
  },
  {
    "code": "GHU",
    "name": "Gualeguaychu Airport",
    "city": "Gualeguaychu",
    "country": "AR"
  },
  {
    "code": "GHV",
    "name": "Brașov-Ghimbav International Airport",
    "city": "Brașov (Ghimbav)",
    "country": "RO"
  },
  {
    "code": "GIB",
    "name": "Gibraltar Airport",
    "city": "Gibraltar",
    "country": "GI"
  },
  {
    "code": "GID",
    "name": "Gitega Airport",
    "city": "Gitega",
    "country": "BI"
  },
  {
    "code": "GIG",
    "name": "Rio Galeão – Tom Jobim International Airport",
    "city": "Rio De Janeiro",
    "country": "BR"
  },
  {
    "code": "GIL",
    "name": "Gilgit Airport",
    "city": "Gilgit",
    "country": "PK"
  },
  {
    "code": "GIR",
    "name": "Santiago Vila Airport",
    "city": "Girardot",
    "country": "CO"
  },
  {
    "code": "GIS",
    "name": "Gisborne Airport",
    "city": "Gisborne",
    "country": "NZ"
  },
  {
    "code": "GIZ",
    "name": "Jizan Regional Airport / King Abdullah bin Abdulaziz Airport",
    "city": "Jizan",
    "country": "SA"
  },
  {
    "code": "GJA",
    "name": "La Laguna Airport",
    "city": "Guanaja",
    "country": "HN"
  },
  {
    "code": "GJL",
    "name": "Jijel Ferhat Abbas Airport",
    "city": "Tahir",
    "country": "DZ"
  },
  {
    "code": "GJM",
    "name": "Guajará-Mirim Airport",
    "city": "Guajará-Mirim",
    "country": "BR"
  },
  {
    "code": "GJT",
    "name": "Grand Junction Regional Airport",
    "city": "Grand Junction",
    "country": "US"
  },
  {
    "code": "GKA",
    "name": "Goroka Airport",
    "city": "Goronka",
    "country": "PG"
  },
  {
    "code": "GKE",
    "name": "Geilenkirchen Air Base",
    "city": "Geilenkirchen",
    "country": "DE"
  },
  {
    "code": "GKN",
    "name": "Gulkana Airport",
    "city": "Gulkana",
    "country": "US"
  },
  {
    "code": "GLA",
    "name": "Glasgow Airport",
    "city": "Glasgow",
    "country": "GB"
  },
  {
    "code": "GLD",
    "name": "Goodland Municipal Airport",
    "city": "Goodland",
    "country": "US"
  },
  {
    "code": "GLF",
    "name": "Golfito Airport",
    "city": "Golfito",
    "country": "CR"
  },
  {
    "code": "GLH",
    "name": "Mid Delta Regional Airport",
    "city": "Greenville",
    "country": "US"
  },
  {
    "code": "GLI",
    "name": "Glen Innes Airport",
    "city": "Glen Innes",
    "country": "AU"
  },
  {
    "code": "GLO",
    "name": "Gloucestershire Airport",
    "city": "Staverton, Gloucestershire",
    "country": "GB"
  },
  {
    "code": "GLS",
    "name": "Scholes International At Galveston Airport",
    "city": "Galveston",
    "country": "US"
  },
  {
    "code": "GLT",
    "name": "Gladstone Airport",
    "city": "Gladstone",
    "country": "AU"
  },
  {
    "code": "GLU",
    "name": "Gelephu Airport",
    "city": "Gelephu",
    "country": "BT"
  },
  {
    "code": "GLZ",
    "name": "Gilze Rijen Air Base",
    "city": "Rijen",
    "country": "NL"
  },
  {
    "code": "GMA",
    "name": "Gemena Airport",
    "city": "Gemena",
    "country": "CD"
  },
  {
    "code": "GMB",
    "name": "Gambela Airport",
    "city": "Gambela",
    "country": "ET"
  },
  {
    "code": "GME",
    "name": "Gomel Airport",
    "city": "Gomel",
    "country": "BY"
  },
  {
    "code": "GMO",
    "name": "Gombe Lawanti International Airport",
    "city": "Gombe",
    "country": "NG"
  },
  {
    "code": "GMP",
    "name": "Gimpo International Airport",
    "city": "Seoul",
    "country": "KR"
  },
  {
    "code": "GMQ",
    "name": "Golog Maqên Airport",
    "city": "Golog (Maqên)",
    "country": "CN"
  },
  {
    "code": "GMR",
    "name": "Totegegie Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "GMU",
    "name": "Greenville Downtown Airport",
    "city": "Greenville",
    "country": "US"
  },
  {
    "code": "GNA",
    "name": "Hrodna Airport",
    "city": "Hrodna",
    "country": "BY"
  },
  {
    "code": "GNB",
    "name": "Grenoble Alpes Isère Airport",
    "city": "Grenoble",
    "country": "FR"
  },
  {
    "code": "GND",
    "name": "Maurice Bishop International Airport",
    "city": "Saint George's",
    "country": "GD"
  },
  {
    "code": "GNJ",
    "name": "Ganja International Airport",
    "city": "Ganja",
    "country": "AZ"
  },
  {
    "code": "GNS",
    "name": "Binaka Airport",
    "city": "Gunungsitoli",
    "country": "ID"
  },
  {
    "code": "GNV",
    "name": "Gainesville Regional Airport",
    "city": "Gainesville",
    "country": "US"
  },
  {
    "code": "GNY",
    "name": "Şanlıurfa GAP Airport",
    "city": "Şanlıurfa",
    "country": "TR"
  },
  {
    "code": "GOA",
    "name": "Genoa Cristoforo Colombo Airport",
    "city": "Genova (GE)",
    "country": "IT"
  },
  {
    "code": "GOH",
    "name": "Nuuk International Airport",
    "city": "Nuuk",
    "country": "GL"
  },
  {
    "code": "GOI",
    "name": "Goa Dabolim International Airport",
    "city": "Vasco da Gama",
    "country": "IN"
  },
  {
    "code": "GOJ",
    "name": "Nizhny Novgorod / Strigino International Airport",
    "city": "Nizhny Novgorod",
    "country": "RU"
  },
  {
    "code": "GOM",
    "name": "Goma International Airport",
    "city": "Goma",
    "country": "CD"
  },
  {
    "code": "GON",
    "name": "Groton New London Airport",
    "city": "Groton",
    "country": "US"
  },
  {
    "code": "GOP",
    "name": "Gorakhpur Airport",
    "city": "Gorakhpur",
    "country": "IN"
  },
  {
    "code": "GOQ",
    "name": "Golmud Airport",
    "city": "Golmud",
    "country": "CN"
  },
  {
    "code": "GOT",
    "name": "Göteborg Landvetter Airport",
    "city": "Göteborg",
    "country": "SE"
  },
  {
    "code": "GOU",
    "name": "Garoua International Airport",
    "city": "Garoua",
    "country": "CM"
  },
  {
    "code": "GOV",
    "name": "Gove Airport",
    "city": "Nhulunbuy",
    "country": "AU"
  },
  {
    "code": "GOX",
    "name": "Manohar International Airport",
    "city": "Mopa",
    "country": "IN"
  },
  {
    "code": "GOZ",
    "name": "Gorna Oryahovitsa Airport",
    "city": "Gorna Oryahovitsa",
    "country": "BG"
  },
  {
    "code": "GPA",
    "name": "Patras Araxos Agamemnon Airport",
    "city": "Patras",
    "country": "GR"
  },
  {
    "code": "GPI",
    "name": "Guapi Airport",
    "city": "Guapi",
    "country": "CO"
  },
  {
    "code": "GPL",
    "name": "Guapiles Airport",
    "city": "Pococi",
    "country": "CR"
  },
  {
    "code": "GPN",
    "name": "Garden Point Airport",
    "city": "Pirlangimpi",
    "country": "AU"
  },
  {
    "code": "GPO",
    "name": "General Pico Airport",
    "city": "General Pico",
    "country": "AR"
  },
  {
    "code": "GPS",
    "name": "Seymour Galapagos Ecological Airport",
    "city": "Isla Baltra",
    "country": "EC"
  },
  {
    "code": "GPT",
    "name": "Gulfport Biloxi International Airport",
    "city": "Gulfport",
    "country": "US"
  },
  {
    "code": "GRB",
    "name": "Austin Straubel International Airport",
    "city": "Green Bay",
    "country": "US"
  },
  {
    "code": "GRF",
    "name": "Gray Army Air Field",
    "city": "Fort Lewis/Tacoma",
    "country": "US"
  },
  {
    "code": "GRI",
    "name": "Central Nebraska Regional Airport",
    "city": "Grand Island",
    "country": "US"
  },
  {
    "code": "GRJ",
    "name": "George Airport",
    "city": "George",
    "country": "ZA"
  },
  {
    "code": "GRK",
    "name": "Killeen Regional Airport / Robert Gray Army Airfield",
    "city": "Fort Cavazos",
    "country": "US"
  },
  {
    "code": "GRO",
    "name": "Girona-Costa Brava Airport",
    "city": "Girona",
    "country": "ES"
  },
  {
    "code": "GRQ",
    "name": "Groningen Airport Eelde",
    "city": "Groningen",
    "country": "NL"
  },
  {
    "code": "GRR",
    "name": "Gerald R. Ford International Airport",
    "city": "Grand Rapids",
    "country": "US"
  },
  {
    "code": "GRS",
    "name": "Grosseto Corrado Baccarini Air Base / Grosseto Airport",
    "city": "Grosseto (GR)",
    "country": "IT"
  },
  {
    "code": "GRU",
    "name": "São Paulo/Guarulhos–Governor André Franco Montoro International Airport",
    "city": "São Paulo",
    "country": "BR"
  },
  {
    "code": "GRV",
    "name": "Grozny Airport",
    "city": "Grozny",
    "country": "RU"
  },
  {
    "code": "GRW",
    "name": "Graciosa Airport",
    "city": "Santa Cruz da Graciosa",
    "country": "PT"
  },
  {
    "code": "GRX",
    "name": "F.G.L. Airport Granada-Jaén Airport",
    "city": "Granada",
    "country": "ES"
  },
  {
    "code": "GRY",
    "name": "Grímsey Airport",
    "city": "Grímsey/Sandvík",
    "country": "IS"
  },
  {
    "code": "GRZ",
    "name": "Graz Airport",
    "city": "Feldkirchen bei Graz",
    "country": "AT"
  },
  {
    "code": "GSB",
    "name": "Seymour Johnson Air Force Base",
    "city": "Goldsboro",
    "country": "US"
  },
  {
    "code": "GSE",
    "name": "Säve Airport",
    "city": "Göteborg",
    "country": "SE"
  },
  {
    "code": "GSJ",
    "name": "San José Airport",
    "city": "Puerto San José",
    "country": "GT"
  },
  {
    "code": "GSM",
    "name": "Qeshm International Airport",
    "city": "Qeshm(Dayrestan)",
    "country": "IR"
  },
  {
    "code": "GSO",
    "name": "Piedmont Triad International Airport",
    "city": "Greensboro",
    "country": "US"
  },
  {
    "code": "GSP",
    "name": "Greenville-Spartanburg International Airport",
    "city": "Greenville/Greer/Spartanburg",
    "country": "US"
  },
  {
    "code": "GST",
    "name": "Gustavus Airport",
    "city": "Gustavus",
    "country": "US"
  },
  {
    "code": "GSV",
    "name": "Gagarin International Airport",
    "city": "Saratov",
    "country": "RU"
  },
  {
    "code": "GTE",
    "name": "Groote Eylandt Airport",
    "city": "Groote Eylandt",
    "country": "AU"
  },
  {
    "code": "GTF",
    "name": "Great Falls International Airport",
    "city": "Great Falls",
    "country": "US"
  },
  {
    "code": "GTN",
    "name": "Glentanner Airport",
    "city": "Glentanner Station",
    "country": "NZ"
  },
  {
    "code": "GTR",
    "name": "Golden Triangle Regional Airport",
    "city": "Columbus/W Point/Starkville",
    "country": "US"
  },
  {
    "code": "GUA",
    "name": "La Aurora International Airport",
    "city": "Guatemala City",
    "country": "GT"
  },
  {
    "code": "GUC",
    "name": "Gunnison Crested Butte Regional Airport",
    "city": "Gunnison",
    "country": "US"
  },
  {
    "code": "GUH",
    "name": "Gunnedah Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "GUI",
    "name": "Guiria Airport",
    "city": null,
    "country": "VE"
  },
  {
    "code": "GUJ",
    "name": "Edu Chaves Field",
    "city": "Guaratinguetá",
    "country": "BR"
  },
  {
    "code": "GUL",
    "name": "Goulburn Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "GUM",
    "name": "Antonio B. Won Pat International Airport",
    "city": "Hagåtña",
    "country": "GU"
  },
  {
    "code": "GUP",
    "name": "Gallup Municipal Airport",
    "city": "Gallup",
    "country": "US"
  },
  {
    "code": "GUQ",
    "name": "Guanare Airport",
    "city": "Guanare",
    "country": "VE"
  },
  {
    "code": "GUR",
    "name": "Gurney Airport",
    "city": "Gurney",
    "country": "PG"
  },
  {
    "code": "GUS",
    "name": "Grissom Air Reserve Base",
    "city": "Peru",
    "country": "US"
  },
  {
    "code": "GUW",
    "name": "Atyrau International Airport",
    "city": "Atyrau",
    "country": "KZ"
  },
  {
    "code": "GUY",
    "name": "Guymon Municipal Airport",
    "city": "Guymon",
    "country": "US"
  },
  {
    "code": "GVA",
    "name": "Geneva Cointrin International Airport",
    "city": "Geneva",
    "country": "CH"
  },
  {
    "code": "GVN",
    "name": "Sovetskaya Gavan (Maygatka) Airport",
    "city": "Sovetskaya Gavan",
    "country": "RU"
  },
  {
    "code": "GVR",
    "name": "Coronel Altino Machado Airport",
    "city": "Governador Valadares",
    "country": "BR"
  },
  {
    "code": "GVX",
    "name": "Gävle Sandviken Airport",
    "city": "Gävle / Sandviken",
    "country": "SE"
  },
  {
    "code": "GWD",
    "name": "New Gwadar International Airport",
    "city": "Gurandani",
    "country": "PK"
  },
  {
    "code": "GWE",
    "name": "Gweru - Thornhill Air Base",
    "city": "Gweru",
    "country": "ZW"
  },
  {
    "code": "GWL",
    "name": "Gwalior Airport",
    "city": "Gwalior",
    "country": "IN"
  },
  {
    "code": "GWO",
    "name": "Greenwood–Leflore Airport",
    "city": "Greenwood",
    "country": "US"
  },
  {
    "code": "GWT",
    "name": "Westerland Sylt Airport",
    "city": "Sylt",
    "country": "DE"
  },
  {
    "code": "GXF",
    "name": "Seiyun Hadhramaut International Airport",
    "city": "Seiyun",
    "country": "YE"
  },
  {
    "code": "GXG",
    "name": "Negage Airport",
    "city": "Negage",
    "country": "AO"
  },
  {
    "code": "GXH",
    "name": "Gannan Xiahe Airport",
    "city": "Gannan (Xiahe)",
    "country": "CN"
  },
  {
    "code": "GXQ",
    "name": "Teniente Vidal Airport",
    "city": "Coyhaique",
    "country": "CL"
  },
  {
    "code": "GYA",
    "name": "Guayaramerín Airport",
    "city": "Guayaramerín",
    "country": "BO"
  },
  {
    "code": "GYD",
    "name": "Heydar Aliyev International Airport",
    "city": "Baku",
    "country": "AZ"
  },
  {
    "code": "GYE",
    "name": "José Joaquín de Olmedo International Airport",
    "city": "Guayaquil",
    "country": "EC"
  },
  {
    "code": "GYG",
    "name": "Magan Airport",
    "city": "Magan",
    "country": "RU"
  },
  {
    "code": "GYI",
    "name": "Gisenyi Airport",
    "city": "Gisenyi",
    "country": "RW"
  },
  {
    "code": "GYM",
    "name": "General José María Yáñez International Airport",
    "city": "Guaymas",
    "country": "MX"
  },
  {
    "code": "GYN",
    "name": "Santa Genoveva International Airport",
    "city": "Goiânia",
    "country": "BR"
  },
  {
    "code": "GYS",
    "name": "Guangyuan Panlong Airport",
    "city": "Guangyuan (Lizhou)",
    "country": "CN"
  },
  {
    "code": "GYU",
    "name": "Guyuan Liupanshan Airport",
    "city": "Guyuan (Yuanzhou)",
    "country": "CN"
  },
  {
    "code": "GYY",
    "name": "Gary Chicago International Airport",
    "city": "Gary",
    "country": "US"
  },
  {
    "code": "GZP",
    "name": "Gazipaşa-Alanya Airport",
    "city": "Gazipaşa",
    "country": "TR"
  },
  {
    "code": "GZT",
    "name": "Gaziantep Oğuzeli International Airport",
    "city": "Gaziantep",
    "country": "TR"
  },
  {
    "code": "GZW",
    "name": "Qazvin Airport",
    "city": "Qazvin",
    "country": "IR"
  },
  {
    "code": "HAC",
    "name": "Hachijojima Airport",
    "city": "Hachijojima",
    "country": "JP"
  },
  {
    "code": "HAD",
    "name": "Halmstad Airport",
    "city": "Halmstad",
    "country": "SE"
  },
  {
    "code": "HAH",
    "name": "Prince Said Ibrahim International Airport",
    "city": "Moroni",
    "country": "KM"
  },
  {
    "code": "HAJ",
    "name": "Hannover Airport",
    "city": "Hannover",
    "country": "DE"
  },
  {
    "code": "HAK",
    "name": "Haikou Meilan International Airport",
    "city": "Haikou (Meilan)",
    "country": "CN"
  },
  {
    "code": "HAM",
    "name": "Hamburg Helmut Schmidt Airport",
    "city": "Hamburg",
    "country": "DE"
  },
  {
    "code": "HAN",
    "name": "Noi Bai International Airport",
    "city": "Hanoi (Soc Son)",
    "country": "VN"
  },
  {
    "code": "HAQ",
    "name": "Hanimaadhoo International Airport",
    "city": "Haa Dhaalu Atoll",
    "country": "MV"
  },
  {
    "code": "HAS",
    "name": "Ha'il Airport",
    "city": "Ha'il",
    "country": "SA"
  },
  {
    "code": "HAU",
    "name": "Haugesund Airport, Karmøy",
    "city": "Karmøy",
    "country": "NO"
  },
  {
    "code": "HAV",
    "name": "José Martí International Airport",
    "city": "Havana",
    "country": "CU"
  },
  {
    "code": "HAW",
    "name": "Haverfordwest Airport",
    "city": "Haverfordwest",
    "country": "GB"
  },
  {
    "code": "HBA",
    "name": "Hobart International Airport",
    "city": "Hobart (Cambridge)",
    "country": "AU"
  },
  {
    "code": "HBE",
    "name": "Alexandria International Airport",
    "city": "Alexandria",
    "country": "EG"
  },
  {
    "code": "HBG",
    "name": "Hattiesburg Bobby L Chain Municipal Airport",
    "city": "Hattiesburg",
    "country": "US"
  },
  {
    "code": "HBR",
    "name": "Hobart Regional Airport",
    "city": "Hobart",
    "country": "US"
  },
  {
    "code": "HBX",
    "name": "Hubballi Airport",
    "city": "Hubballi",
    "country": "IN"
  },
  {
    "code": "HCJ",
    "name": "Hechi Jinchengjiang Airport",
    "city": "Hechi (Jinchengjiang)",
    "country": "CN"
  },
  {
    "code": "HCN",
    "name": "Hengchun Airport",
    "city": "Hengchun",
    "country": "TW"
  },
  {
    "code": "HCQ",
    "name": "Halls Creek Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "HCR",
    "name": "Holy Cross Airport",
    "city": "Holy Cross",
    "country": "US"
  },
  {
    "code": "HCZ",
    "name": "Chenzhou Beihu Airport",
    "city": "Chenzhou",
    "country": "CN"
  },
  {
    "code": "HDF",
    "name": "Heringsdorf Airport",
    "city": "Zirchow",
    "country": "DE"
  },
  {
    "code": "HDG",
    "name": "Handan Airport",
    "city": "Handan",
    "country": "CN"
  },
  {
    "code": "HDM",
    "name": "Hamadan Airport",
    "city": "Hamadan",
    "country": "IR"
  },
  {
    "code": "HDN",
    "name": "Yampa Valley Airport",
    "city": "Hayden",
    "country": "US"
  },
  {
    "code": "HDS",
    "name": "Eastgate Airport / Air Force Base Hoedspruit",
    "city": "Hoedspruit",
    "country": "ZA"
  },
  {
    "code": "HDY",
    "name": "Hat Yai International Airport",
    "city": "Hat Yai",
    "country": "TH"
  },
  {
    "code": "HEA",
    "name": "Herat - Khwaja Abdullah Ansari International Airport",
    "city": "Guzara",
    "country": "AF"
  },
  {
    "code": "HEK",
    "name": "Heihe Aihui Airport",
    "city": "Heihe",
    "country": "CN"
  },
  {
    "code": "HEL",
    "name": "Helsinki Vantaa Airport",
    "city": "Helsinki (Vantaa)",
    "country": "FI"
  },
  {
    "code": "HER",
    "name": "Heraklion International Nikos Kazantzakis Airport",
    "city": "Heraklion",
    "country": "GR"
  },
  {
    "code": "HET",
    "name": "Hohhot Baita International Airport",
    "city": "Hohhot",
    "country": "CN"
  },
  {
    "code": "HFA",
    "name": "Uri Michaeli Haifa International Airport",
    "city": "Haifa",
    "country": "IL"
  },
  {
    "code": "HFD",
    "name": "Hartford Brainard Airport",
    "city": "Hartford",
    "country": "US"
  },
  {
    "code": "HFE",
    "name": "Hefei Xinqiao International Airport",
    "city": "Hefei",
    "country": "CN"
  },
  {
    "code": "HFN",
    "name": "Hornafjörður Airport",
    "city": "Höfn",
    "country": "IS"
  },
  {
    "code": "HFT",
    "name": "Hammerfest Airport",
    "city": "Hammerfest",
    "country": "NO"
  },
  {
    "code": "HGA",
    "name": "Egal International Airport",
    "city": "Hargeisa",
    "country": "SO"
  },
  {
    "code": "HGH",
    "name": "Hangzhou Xiaoshan International Airport",
    "city": "Hangzhou",
    "country": "CN"
  },
  {
    "code": "HGI",
    "name": "Itanagar Donyi Polo Hollongi Airport",
    "city": "Hollongi",
    "country": "IN"
  },
  {
    "code": "HGN",
    "name": "Mae Hong Son Airport",
    "city": "Mae Hong Son",
    "country": "TH"
  },
  {
    "code": "HGO",
    "name": "Korhogo Airport",
    "city": "Korhogo",
    "country": "CI"
  },
  {
    "code": "HGR",
    "name": "Hagerstown Regional Richard A Henson Field",
    "city": "Hagerstown",
    "country": "US"
  },
  {
    "code": "HGU",
    "name": "Mount Hagen Kagamuga Airport",
    "city": "Mount Hagen",
    "country": "PG"
  },
  {
    "code": "HHE",
    "name": "JMSDF Hachinohe Air Base / Hachinohe Airport",
    "city": "Hachinohe",
    "country": "JP"
  },
  {
    "code": "HHH",
    "name": "Hilton Head Airport",
    "city": "Hilton Head Island",
    "country": "US"
  },
  {
    "code": "HHN",
    "name": "Frankfurt-Hahn Airport",
    "city": "Frankfurt am Main (Lautzenhausen)",
    "country": "DE"
  },
  {
    "code": "HHQ",
    "name": "Hua Hin Airport",
    "city": "Hua Hin",
    "country": "TH"
  },
  {
    "code": "HHR",
    "name": "Jack Northrop Field Hawthorne Municipal Airport",
    "city": "Hawthorne",
    "country": "US"
  },
  {
    "code": "HIA",
    "name": "Huai'an Lianshui International Airport",
    "city": "Huai'an",
    "country": "CN"
  },
  {
    "code": "HIB",
    "name": "Range Regional Airport",
    "city": "Hibbing",
    "country": "US"
  },
  {
    "code": "HID",
    "name": "Horn Island Airport",
    "city": "Horn",
    "country": "AU"
  },
  {
    "code": "HIF",
    "name": "Hill Air Force Base",
    "city": "Ogden",
    "country": "US"
  },
  {
    "code": "HII",
    "name": "Lake Havasu City International Airport",
    "city": "Lake Havasu City",
    "country": "US"
  },
  {
    "code": "HIJ",
    "name": "Hiroshima Airport",
    "city": "Hiroshima",
    "country": "JP"
  },
  {
    "code": "HIM",
    "name": "Hingurakgoda Air Force Base",
    "city": "Polonnaruwa Town",
    "country": "LK"
  },
  {
    "code": "HIN",
    "name": "Sacheon Airport / Sacheon Air Base",
    "city": "Sacheon",
    "country": "KR"
  },
  {
    "code": "HIO",
    "name": "Portland Hillsboro Airport",
    "city": "Portland",
    "country": "US"
  },
  {
    "code": "HIR",
    "name": "Honiara International Airport",
    "city": "Honiara",
    "country": "SB"
  },
  {
    "code": "HJJ",
    "name": "Huaihua Zhijiang Airport",
    "city": "Huaihua",
    "country": "CN"
  },
  {
    "code": "HJR",
    "name": "Khajuraho Airport",
    "city": "Khajuraho",
    "country": "IN"
  },
  {
    "code": "HKD",
    "name": "Hakodate Airport",
    "city": "Hakodate",
    "country": "JP"
  },
  {
    "code": "HKG",
    "name": "Hong Kong International Airport",
    "city": "Hong Kong",
    "country": "HK"
  },
  {
    "code": "HKK",
    "name": "Hokitika Airfield",
    "city": null,
    "country": "NZ"
  },
  {
    "code": "HKN",
    "name": "Hoskins Airport",
    "city": "Kimbe",
    "country": "PG"
  },
  {
    "code": "HKT",
    "name": "Phuket International Airport",
    "city": "Phuket",
    "country": "TH"
  },
  {
    "code": "HKY",
    "name": "Hickory Regional Airport",
    "city": "Hickory",
    "country": "US"
  },
  {
    "code": "HLA",
    "name": "Lanseria International Airport",
    "city": "Johannesburg",
    "country": "ZA"
  },
  {
    "code": "HLD",
    "name": "Hulunbuir Hailar Airport",
    "city": "Hailar",
    "country": "CN"
  },
  {
    "code": "HLE",
    "name": "Saint Helena International Airport",
    "city": "Jamestown",
    "country": "SH"
  },
  {
    "code": "HLG",
    "name": "Wheeling Ohio County Airport",
    "city": "Wheeling",
    "country": "US"
  },
  {
    "code": "HLN",
    "name": "Helena Regional Airport",
    "city": "Helena",
    "country": "US"
  },
  {
    "code": "HLP",
    "name": "Halim Perdanakusuma International Airport",
    "city": "Jakarta",
    "country": "ID"
  },
  {
    "code": "HLT",
    "name": "Hamilton Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "HLZ",
    "name": "Hamilton International Airport",
    "city": "Hamilton",
    "country": "NZ"
  },
  {
    "code": "HMA",
    "name": "Khanty Mansiysk Airport",
    "city": "Khanty-Mansiysk",
    "country": "RU"
  },
  {
    "code": "HMB",
    "name": "Sohag International Airport",
    "city": "Suhaj",
    "country": "EG"
  },
  {
    "code": "HME",
    "name": "Hassi Messaoud-Oued Irara Krim Belkacem Airport",
    "city": "Hassi Messaoud",
    "country": "DZ"
  },
  {
    "code": "HMI",
    "name": "Hami Airport",
    "city": "Hami",
    "country": "CN"
  },
  {
    "code": "HMJ",
    "name": "Khmelnytskyi Airport",
    "city": "Khmelnytskyi",
    "country": "UA"
  },
  {
    "code": "HMN",
    "name": "Holloman Air Force Base",
    "city": "Alamogordo",
    "country": "US"
  },
  {
    "code": "HMO",
    "name": "General Ignacio L. Pesqueira International Airport",
    "city": "Hermosillo",
    "country": "MX"
  },
  {
    "code": "HNA",
    "name": "Iwate Hanamaki Airport",
    "city": "Hanamaki",
    "country": "JP"
  },
  {
    "code": "HND",
    "name": "Tokyo Haneda International Airport",
    "city": "Tokyo",
    "country": "JP"
  },
  {
    "code": "HNL",
    "name": "Daniel K. Inouye International Airport",
    "city": "Honolulu, Oahu",
    "country": "US"
  },
  {
    "code": "HNM",
    "name": "Hana Airport",
    "city": "Hana",
    "country": "US"
  },
  {
    "code": "HNS",
    "name": "Haines Airport",
    "city": "Haines",
    "country": "US"
  },
  {
    "code": "HOB",
    "name": "Lea County Regional Airport",
    "city": "Hobbs",
    "country": "US"
  },
  {
    "code": "HOF",
    "name": "Al-Ahsa International Airport",
    "city": "Hofuf",
    "country": "SA"
  },
  {
    "code": "HOG",
    "name": "Frank Pais International Airport",
    "city": "Holguin",
    "country": "CU"
  },
  {
    "code": "HOI",
    "name": "Hao Airport",
    "city": "Otepa",
    "country": "PF"
  },
  {
    "code": "HOM",
    "name": "Homer Airport",
    "city": "Homer",
    "country": "US"
  },
  {
    "code": "HON",
    "name": "Huron Regional Airport",
    "city": "Huron",
    "country": "US"
  },
  {
    "code": "HOP",
    "name": "Campbell Army Airfield (Fort Campbell)",
    "city": "Fort Campbell",
    "country": "US"
  },
  {
    "code": "HOQ",
    "name": "Hof-Plauen Airport",
    "city": "Hof",
    "country": "DE"
  },
  {
    "code": "HOR",
    "name": "Horta Airport",
    "city": "Horta",
    "country": "PT"
  },
  {
    "code": "HOT",
    "name": "Memorial Field Airport",
    "city": "Hot Springs",
    "country": "US"
  },
  {
    "code": "HOU",
    "name": "William P. Hobby Airport",
    "city": "Houston",
    "country": "US"
  },
  {
    "code": "HOV",
    "name": "Ørsta-Volda Airport, Hovden",
    "city": "Ørsta",
    "country": "NO"
  },
  {
    "code": "HPA",
    "name": "Lifuka Island Airport",
    "city": "Lifuka",
    "country": "TO"
  },
  {
    "code": "HPG",
    "name": "Shennongjia Hongping Airport",
    "city": "Shennongjia (Hongping)",
    "country": "CN"
  },
  {
    "code": "HPH",
    "name": "Cat Bi International Airport",
    "city": "Haiphong (Hai An)",
    "country": "VN"
  },
  {
    "code": "HPN",
    "name": "Westchester County Airport",
    "city": "White Plains",
    "country": "US"
  },
  {
    "code": "HQL",
    "name": "Tashikuergan Hongqilafu Airport",
    "city": "Tashikuergan",
    "country": "CN"
  },
  {
    "code": "HQM",
    "name": "Bowerman Airport",
    "city": "Hoquiam",
    "country": "US"
  },
  {
    "code": "HRB",
    "name": "Harbin Taiping International Airport",
    "city": "Harbin",
    "country": "CN"
  },
  {
    "code": "HRE",
    "name": "Robert Gabriel Mugabe International Airport",
    "city": "Harare",
    "country": "ZW"
  },
  {
    "code": "HRG",
    "name": "Hurghada International Airport",
    "city": "Hurghada",
    "country": "EG"
  },
  {
    "code": "HRI",
    "name": "Mattala Rajapaksa International Airport",
    "city": "Mattala",
    "country": "LK"
  },
  {
    "code": "HRK",
    "name": "Kharkiv International Airport",
    "city": "Kharkiv",
    "country": "UA"
  },
  {
    "code": "HRL",
    "name": "Valley International Airport",
    "city": "Harlingen",
    "country": "US"
  },
  {
    "code": "HRM",
    "name": "Hassi R'Mel Airport",
    "city": "Hassi R'Mel",
    "country": "DZ"
  },
  {
    "code": "HRO",
    "name": "Boone County Airport",
    "city": "Harrison",
    "country": "US"
  },
  {
    "code": "HRS",
    "name": "Harrismith Airport",
    "city": "Harrismith",
    "country": "ZA"
  },
  {
    "code": "HSA",
    "name": "Hazrat Sultan International Airport",
    "city": "Turkıstan",
    "country": "KZ"
  },
  {
    "code": "HSC",
    "name": "Shaoguan Danxia Airport",
    "city": "Shaoguan",
    "country": "CN"
  },
  {
    "code": "HSG",
    "name": "Kyushu Saga International Airport",
    "city": "Saga",
    "country": "JP"
  },
  {
    "code": "HSL",
    "name": "Huslia Airport",
    "city": "Huslia",
    "country": "US"
  },
  {
    "code": "HSM",
    "name": "Horsham Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "HSN",
    "name": "Zhoushan Putuoshan Airport",
    "city": "Zhoushan",
    "country": "CN"
  },
  {
    "code": "HSR",
    "name": "Rajkot International Airport",
    "city": "Rajkot",
    "country": "IN"
  },
  {
    "code": "HSS",
    "name": "Maharaja Agrasen International Airport",
    "city": "Hisar",
    "country": "IN"
  },
  {
    "code": "HST",
    "name": "Homestead ARB Airport",
    "city": "Homestead",
    "country": "US"
  },
  {
    "code": "HSV",
    "name": "Huntsville International Airport",
    "city": "Huntsville",
    "country": "US"
  },
  {
    "code": "HSZ",
    "name": "Hsinchu Air Base",
    "city": "Hsinchu City",
    "country": "TW"
  },
  {
    "code": "HTA",
    "name": "Chita-Kadala International Airport",
    "city": "Chita",
    "country": "RU"
  },
  {
    "code": "HTG",
    "name": "Khatanga Airport",
    "city": "Khatanga",
    "country": "RU"
  },
  {
    "code": "HTI",
    "name": "Hamilton Island Airport",
    "city": "Hamilton Island",
    "country": "AU"
  },
  {
    "code": "HTN",
    "name": "Hotan Airport",
    "city": "Hotan",
    "country": "CN"
  },
  {
    "code": "HTS",
    "name": "Tri-State Airport / Milton J. Ferguson Field",
    "city": "Huntington",
    "country": "US"
  },
  {
    "code": "HTT",
    "name": "Huatugou Airport",
    "city": "Mengnai",
    "country": "CN"
  },
  {
    "code": "HTU",
    "name": "Hopetoun Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "HTV",
    "name": "Huntsville Regional Airport",
    "city": "Huntsville",
    "country": "US"
  },
  {
    "code": "HTY",
    "name": "Hatay Airport",
    "city": "Antakya",
    "country": "TR"
  },
  {
    "code": "HUA",
    "name": "Redstone Army Air Field",
    "city": "Redstone Arsnl Huntsville",
    "country": "US"
  },
  {
    "code": "HUF",
    "name": "Terre Haute Regional Airport, Hulman Field",
    "city": "Terre Haute",
    "country": "US"
  },
  {
    "code": "HUH",
    "name": "Huahine-Fare Airport",
    "city": "Fare",
    "country": "PF"
  },
  {
    "code": "HUI",
    "name": "Phu Bai International Airport",
    "city": "Huế",
    "country": "VN"
  },
  {
    "code": "HUL",
    "name": "Houlton International Airport",
    "city": "Houlton",
    "country": "US"
  },
  {
    "code": "HUN",
    "name": "Hualien Chiashan Airport",
    "city": "Hualien City",
    "country": "TW"
  },
  {
    "code": "HUO",
    "name": "Holingol Huolinhe Airport",
    "city": "Holingol",
    "country": "CN"
  },
  {
    "code": "HUT",
    "name": "Hutchinson Municipal Airport",
    "city": "Hutchinson",
    "country": "US"
  },
  {
    "code": "HUU",
    "name": "Alferez Fap David Figueroa Fernandini Airport",
    "city": "Huánuco",
    "country": "PE"
  },
  {
    "code": "HUX",
    "name": "Bahías de Huatulco International Airport",
    "city": "Huatulco",
    "country": "MX"
  },
  {
    "code": "HUY",
    "name": "Humberside Airport",
    "city": "Grimsby, Lincolnshire",
    "country": "GB"
  },
  {
    "code": "HUZ",
    "name": "Huizhou Pingtan Airport",
    "city": "Huizhou (Pingtan)",
    "country": "CN"
  },
  {
    "code": "HVA",
    "name": "Analalava Airport",
    "city": "Analalava",
    "country": "MG"
  },
  {
    "code": "HVB",
    "name": "Hervey Bay Airport",
    "city": "Hervey Bay",
    "country": "AU"
  },
  {
    "code": "HVD",
    "name": "Khovd Airport",
    "city": "Khovd",
    "country": "MN"
  },
  {
    "code": "HVG",
    "name": "Honningsvåg Airport, Valan",
    "city": "Honningsvåg",
    "country": "NO"
  },
  {
    "code": "HVN",
    "name": "Tweed New Haven Airport",
    "city": "New Haven",
    "country": "US"
  },
  {
    "code": "HVR",
    "name": "Havre City County Airport",
    "city": "Havre",
    "country": "US"
  },
  {
    "code": "HWN",
    "name": "Hwange National Park Airport",
    "city": "Gwayi River Farms",
    "country": "ZW"
  },
  {
    "code": "HWO",
    "name": "North Perry Airport",
    "city": "Hollywood",
    "country": "US"
  },
  {
    "code": "HXX",
    "name": "Hay Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "HYA",
    "name": "Cape Cod Gateway Airport",
    "city": "Hyannis",
    "country": "US"
  },
  {
    "code": "HYD",
    "name": "Rajiv Gandhi International Airport",
    "city": "Hyderabad",
    "country": "IN"
  },
  {
    "code": "HYN",
    "name": "Taizhou Luqiao Airport",
    "city": "Taizhou (Luqiao)",
    "country": "CN"
  },
  {
    "code": "HYR",
    "name": "Sawyer County Airport",
    "city": "Hayward",
    "country": "US"
  },
  {
    "code": "HYS",
    "name": "Hays Regional Airport",
    "city": "Hays",
    "country": "US"
  },
  {
    "code": "HZA",
    "name": "Heze Mudan Airport",
    "city": "Heze (Dingtao)",
    "country": "CN"
  },
  {
    "code": "HZB",
    "name": "Merville-Calonne Airport",
    "city": "Merville, Nord",
    "country": "FR"
  },
  {
    "code": "HZH",
    "name": "Liping Airport",
    "city": "Liping",
    "country": "CN"
  },
  {
    "code": "HZK",
    "name": "Húsavík Airport",
    "city": "Húsavík",
    "country": "IS"
  },
  {
    "code": "HZU",
    "name": "Chengdu Huaizhou Airport",
    "city": "Chengdu (Jintang)",
    "country": "CN"
  },
  {
    "code": "IAA",
    "name": "Igarka Airport",
    "city": "Igarka",
    "country": "RU"
  },
  {
    "code": "IAB",
    "name": "McConnell Air Force Base",
    "city": "Wichita",
    "country": "US"
  },
  {
    "code": "IAD",
    "name": "Washington Dulles International Airport",
    "city": "Dulles",
    "country": "US"
  },
  {
    "code": "IAG",
    "name": "Niagara Falls International Airport",
    "city": "Niagara Falls",
    "country": "US"
  },
  {
    "code": "IAH",
    "name": "George Bush Intercontinental Airport",
    "city": "Houston",
    "country": "US"
  },
  {
    "code": "IAM",
    "name": "Zarzaitine - In Aménas Airport",
    "city": "In Aménas",
    "country": "DZ"
  },
  {
    "code": "IAN",
    "name": "Bob Baker Memorial Airport",
    "city": "Kiana",
    "country": "US"
  },
  {
    "code": "IAR",
    "name": "Golden Ring Yaroslavl International Airport",
    "city": "Tunoshna",
    "country": "RU"
  },
  {
    "code": "IAS",
    "name": "Iaşi International Airport",
    "city": "Iaşi",
    "country": "RO"
  },
  {
    "code": "IBA",
    "name": "Ibadan Airport",
    "city": "Ibadan",
    "country": "NG"
  },
  {
    "code": "IBE",
    "name": "Perales Airport",
    "city": "Ibagué",
    "country": "CO"
  },
  {
    "code": "IBL",
    "name": "Indigo Bay Lodge Airport",
    "city": "Bazaruto Island",
    "country": "MZ"
  },
  {
    "code": "IBP",
    "name": "Iberia Airport",
    "city": "Iberia",
    "country": "PE"
  },
  {
    "code": "IBR",
    "name": "Ibaraki International Airport",
    "city": "Omitama",
    "country": "JP"
  },
  {
    "code": "IBZ",
    "name": "Ibiza Airport",
    "city": "Ibiza (Eivissa)",
    "country": "ES"
  },
  {
    "code": "ICN",
    "name": "Incheon International Airport",
    "city": "Seoul",
    "country": "KR"
  },
  {
    "code": "ICT",
    "name": "Wichita Dwight D. Eisenhower National Airport",
    "city": "Wichita",
    "country": "US"
  },
  {
    "code": "IDA",
    "name": "Idaho Falls Regional Airport",
    "city": "Idaho Falls",
    "country": "US"
  },
  {
    "code": "IDR",
    "name": "Devi Ahilya Bai Holkar International Airport",
    "city": "Indore",
    "country": "IN"
  },
  {
    "code": "IEG",
    "name": "Zielona Góra-Babimost Airport",
    "city": "Nowe Kramsko",
    "country": "PL"
  },
  {
    "code": "IEJ",
    "name": "Iejima Airport",
    "city": "Ie",
    "country": "JP"
  },
  {
    "code": "IEV",
    "name": "Ihor Sikorsky Kyiv International Airport (Zhuliany)",
    "city": "Kyiv",
    "country": "UA"
  },
  {
    "code": "IFJ",
    "name": "Ísafjörður Airport",
    "city": "Ísafjörður",
    "country": "IS"
  },
  {
    "code": "IFN",
    "name": "Isfahan Shahid Beheshti International Airport",
    "city": "Isfahan",
    "country": "IR"
  },
  {
    "code": "IFO",
    "name": "Ivano-Frankivsk International Airport",
    "city": "Ivano-Frankivsk",
    "country": "UA"
  },
  {
    "code": "IFP",
    "name": "Laughlin Bullhead International Airport",
    "city": "Bullhead City",
    "country": "US"
  },
  {
    "code": "IGA",
    "name": "Inagua Airport",
    "city": "Matthew Town",
    "country": "BS"
  },
  {
    "code": "IGD",
    "name": "Iğdır Airport",
    "city": "Iğdır",
    "country": "TR"
  },
  {
    "code": "IGL",
    "name": "Çiğli Airbase",
    "city": "Çiğli",
    "country": "TR"
  },
  {
    "code": "IGM",
    "name": "Kingman Airport",
    "city": "Kingman",
    "country": "US"
  },
  {
    "code": "IGR",
    "name": "Cataratas Del Iguazú International Airport",
    "city": "Puerto Iguazu",
    "country": "AR"
  },
  {
    "code": "IGS",
    "name": "Ingolstadt Manching Airport",
    "city": "Manching",
    "country": "DE"
  },
  {
    "code": "IGT",
    "name": "Magas Airport",
    "city": "Sunzha",
    "country": "RU"
  },
  {
    "code": "IGU",
    "name": "Cataratas International Airport",
    "city": "Foz do Iguaçu",
    "country": "BR"
  },
  {
    "code": "IHR",
    "name": "Iranshahr Airport",
    "city": "Iranshahr",
    "country": "IR"
  },
  {
    "code": "IIL",
    "name": "Ilam Airport",
    "city": "Ilam",
    "country": "IR"
  },
  {
    "code": "IJK",
    "name": "Izhevsk Airport",
    "city": "Izhevsk",
    "country": "RU"
  },
  {
    "code": "IKA",
    "name": "Imam Khomeini International Airport",
    "city": "Tehran",
    "country": "IR"
  },
  {
    "code": "IKI",
    "name": "Iki Airport",
    "city": "Iki",
    "country": "JP"
  },
  {
    "code": "IKK",
    "name": "Greater Kankakee Airport",
    "city": "Kankakee",
    "country": "US"
  },
  {
    "code": "IKS",
    "name": "Tiksi Airport",
    "city": "Tiksi",
    "country": "RU"
  },
  {
    "code": "IKT",
    "name": "Irkutsk International Airport",
    "city": "Irkutsk",
    "country": "RU"
  },
  {
    "code": "IKU",
    "name": "Issyk-Kul International Airport",
    "city": "Tamchy",
    "country": "KG"
  },
  {
    "code": "ILD",
    "name": "Lleida-Alguaire Airport",
    "city": "Lleida",
    "country": "ES"
  },
  {
    "code": "ILG",
    "name": "Wilmington Airport",
    "city": "Wilmington",
    "country": "US"
  },
  {
    "code": "ILI",
    "name": "Iliamna Airport",
    "city": "Iliamna",
    "country": "US"
  },
  {
    "code": "ILM",
    "name": "Wilmington International Airport",
    "city": "Wilmington",
    "country": "US"
  },
  {
    "code": "ILN",
    "name": "Wilmington Airpark",
    "city": "Wilmington",
    "country": "US"
  },
  {
    "code": "ILO",
    "name": "Iloilo International Airport",
    "city": "Cabatuan",
    "country": "PH"
  },
  {
    "code": "ILP",
    "name": "Île des Pins Airport",
    "city": "Île des Pins",
    "country": "NC"
  },
  {
    "code": "ILQ",
    "name": "General Jorge Fernandez Maldon Airport",
    "city": "Ilo",
    "country": "PE"
  },
  {
    "code": "ILR",
    "name": "General Tunde Idiagbon International Airport",
    "city": "Ilorin/Ogbomosho",
    "country": "NG"
  },
  {
    "code": "ILS",
    "name": "Ilopango International Airport",
    "city": "San Salvador",
    "country": "SV"
  },
  {
    "code": "ILY",
    "name": "Islay Airport",
    "city": "Isle of Islay, Argyll and Bute",
    "country": "GB"
  },
  {
    "code": "ILZ",
    "name": "Žilina-Dolný Hričov Airport",
    "city": "Dolný Hričov",
    "country": "SK"
  },
  {
    "code": "IMF",
    "name": "Bir Tikendrajit International Airport",
    "city": "Imphal",
    "country": "IN"
  },
  {
    "code": "IMP",
    "name": "Prefeito Renato Moreira Airport",
    "city": "Imperatriz",
    "country": "BR"
  },
  {
    "code": "IMQ",
    "name": "Maku National Airport",
    "city": "Showt",
    "country": "IR"
  },
  {
    "code": "IMT",
    "name": "Ford Airport",
    "city": "Kingsford",
    "country": "US"
  },
  {
    "code": "INA",
    "name": "Inta Airport",
    "city": "Inta",
    "country": "RU"
  },
  {
    "code": "INC",
    "name": "Yinchuan Hedong International Airport",
    "city": "Yinchuan",
    "country": "CN"
  },
  {
    "code": "IND",
    "name": "Indianapolis International Airport",
    "city": "Indianapolis",
    "country": "US"
  },
  {
    "code": "INH",
    "name": "Inhambane Airport",
    "city": "Inhambane",
    "country": "MZ"
  },
  {
    "code": "INI",
    "name": "Niš Constantine the Great Airport",
    "city": "Niš",
    "country": "RS"
  },
  {
    "code": "INK",
    "name": "Winkler County Airport",
    "city": "Wink",
    "country": "US"
  },
  {
    "code": "INL",
    "name": "Falls International Airport",
    "city": "International Falls",
    "country": "US"
  },
  {
    "code": "INN",
    "name": "Innsbruck Airport",
    "city": "Innsbruck",
    "country": "AT"
  },
  {
    "code": "INT",
    "name": "Smith Reynolds Airport",
    "city": "Winston Salem",
    "country": "US"
  },
  {
    "code": "INU",
    "name": "Nauru International Airport",
    "city": "Yaren District",
    "country": "NR"
  },
  {
    "code": "INV",
    "name": "Inverness Airport",
    "city": "Inverness",
    "country": "GB"
  },
  {
    "code": "INW",
    "name": "Winslow Lindbergh Regional Airport",
    "city": "Winslow",
    "country": "US"
  },
  {
    "code": "INZ",
    "name": "In Salah Airport",
    "city": "In Salah",
    "country": "DZ"
  },
  {
    "code": "IOA",
    "name": "Ioannina King Pyrrhus National Airport",
    "city": "Ioannina",
    "country": "GR"
  },
  {
    "code": "IOM",
    "name": "Isle of Man Airport",
    "city": "Castletown",
    "country": "IM"
  },
  {
    "code": "IOS",
    "name": "Bahia - Jorge Amado Airport",
    "city": "Ilhéus",
    "country": "BR"
  },
  {
    "code": "IPC",
    "name": "Mataveri International Airport",
    "city": "Isla De Pascua",
    "country": "CL"
  },
  {
    "code": "IPH",
    "name": "Sultan Azlan Shah Airport",
    "city": "Ipoh",
    "country": "MY"
  },
  {
    "code": "IPI",
    "name": "San Luis Airport",
    "city": "Ipiales",
    "country": "CO"
  },
  {
    "code": "IPL",
    "name": "Imperial County Airport",
    "city": "Imperial",
    "country": "US"
  },
  {
    "code": "IPN",
    "name": "Usiminas Airport",
    "city": "Ipatinga",
    "country": "BR"
  },
  {
    "code": "IPT",
    "name": "Williamsport Regional Airport",
    "city": "Williamsport",
    "country": "US"
  },
  {
    "code": "IQA",
    "name": "Al Asad Air Base",
    "city": "Hīt",
    "country": "IQ"
  },
  {
    "code": "IQM",
    "name": "Qiemo Yudu Airport",
    "city": "Qiemo",
    "country": "CN"
  },
  {
    "code": "IQN",
    "name": "Qingyang Xifeng Airport",
    "city": "Qingyang (Xifeng)",
    "country": "CN"
  },
  {
    "code": "IQQ",
    "name": "Diego Aracena Airport",
    "city": "Iquique",
    "country": "CL"
  },
  {
    "code": "IQT",
    "name": "Coronel FAP Francisco Secada Vignetta International Airport",
    "city": "Iquitos",
    "country": "PE"
  },
  {
    "code": "IRD",
    "name": "Ishurdi Airport",
    "city": "Ishurdi",
    "country": "BD"
  },
  {
    "code": "IRG",
    "name": "Lockhart River Airport",
    "city": "Lockhart River",
    "country": "AU"
  },
  {
    "code": "IRI",
    "name": "Iringa Airport",
    "city": "Nduli",
    "country": "TZ"
  },
  {
    "code": "IRJ",
    "name": "Capitan V A Almonacid Airport",
    "city": "La Rioja",
    "country": "AR"
  },
  {
    "code": "IRK",
    "name": "Kirksville Regional Airport",
    "city": "Kirksville",
    "country": "US"
  },
  {
    "code": "IRP",
    "name": "Matari Airport",
    "city": "Isiro",
    "country": "CD"
  },
  {
    "code": "ISA",
    "name": "Mount Isa Airport",
    "city": "Mount Isa",
    "country": "AU"
  },
  {
    "code": "ISB",
    "name": "Islamabad International Airport",
    "city": "Attock",
    "country": "PK"
  },
  {
    "code": "ISE",
    "name": "Süleyman Demirel International Airport",
    "city": "Isparta",
    "country": "TR"
  },
  {
    "code": "ISG",
    "name": "New Ishigaki Airport",
    "city": "Ishigaki",
    "country": "JP"
  },
  {
    "code": "ISK",
    "name": "Nashik Airport",
    "city": "Nasik",
    "country": "IN"
  },
  {
    "code": "ISL",
    "name": "İstanbul Atatürk Airport",
    "city": "Istanbul(Bakırköy)",
    "country": "TR"
  },
  {
    "code": "ISM",
    "name": "Kissimmee Gateway Airport",
    "city": "Orlando",
    "country": "US"
  },
  {
    "code": "ISO",
    "name": "Kinston Regional Jetport At Stallings Field",
    "city": "Kinston",
    "country": "US"
  },
  {
    "code": "ISP",
    "name": "Long Island MacArthur Airport",
    "city": "Islip",
    "country": "US"
  },
  {
    "code": "IST",
    "name": "İstanbul Airport",
    "city": "Arnavutköy, Istanbul",
    "country": "TR"
  },
  {
    "code": "ISU",
    "name": "Sulaymaniyah International Airport",
    "city": "Sulaymaniyah",
    "country": "IQ"
  },
  {
    "code": "ITA",
    "name": "Itacoatiara Airport",
    "city": "Itacoatiara",
    "country": "BR"
  },
  {
    "code": "ITB",
    "name": "Itaituba Airport",
    "city": "Itaituba",
    "country": "BR"
  },
  {
    "code": "ITH",
    "name": "Ithaca Tompkins Regional Airport",
    "city": "Ithaca",
    "country": "US"
  },
  {
    "code": "ITM",
    "name": "Osaka Itami International Airport",
    "city": "Osaka",
    "country": "JP"
  },
  {
    "code": "ITO",
    "name": "Hilo International Airport",
    "city": "Hilo",
    "country": "US"
  },
  {
    "code": "IUE",
    "name": "Niue International Airport",
    "city": "Alofi",
    "country": "NU"
  },
  {
    "code": "IVC",
    "name": "Invercargill Airport",
    "city": "Invercargill",
    "country": "NZ"
  },
  {
    "code": "IVL",
    "name": "Ivalo Airport",
    "city": "Ivalo",
    "country": "FI"
  },
  {
    "code": "IVR",
    "name": "Inverell Airport",
    "city": "Inverell",
    "country": "AU"
  },
  {
    "code": "IWA",
    "name": "Ivanovo South Airport",
    "city": "Ivanovo",
    "country": "RU"
  },
  {
    "code": "IWJ",
    "name": "Iwami Airport",
    "city": "Masuda",
    "country": "JP"
  },
  {
    "code": "IWK",
    "name": "Iwakuni Kintaikyo Airport",
    "city": "Iwakuni",
    "country": "JP"
  },
  {
    "code": "IWO",
    "name": "Ioto (Iwo Jima) Airbase",
    "city": "Ogasawara",
    "country": "JP"
  },
  {
    "code": "IXA",
    "name": "Agartala - Maharaja Bir Bikram Airport",
    "city": "Agartala",
    "country": "IN"
  },
  {
    "code": "IXB",
    "name": "Bagdogra Airport",
    "city": "Siliguri",
    "country": "IN"
  },
  {
    "code": "IXC",
    "name": "Shaheed Bhagat Singh International Airport",
    "city": "Chandigarh",
    "country": "IN"
  },
  {
    "code": "IXD",
    "name": "Prayagraj Airport",
    "city": "Allahabad",
    "country": "IN"
  },
  {
    "code": "IXE",
    "name": "Mangaluru International Airport",
    "city": "Mangaluru",
    "country": "IN"
  },
  {
    "code": "IXG",
    "name": "Belagavi Airport",
    "city": "Belgaum",
    "country": "IN"
  },
  {
    "code": "IXH",
    "name": "Kailashahar Airport",
    "city": "Kailashahar",
    "country": "IN"
  },
  {
    "code": "IXI",
    "name": "Lilabari North Lakhimpur Airport",
    "city": "Lilabari",
    "country": "IN"
  },
  {
    "code": "IXJ",
    "name": "Jammu Airport",
    "city": "Jammu",
    "country": "IN"
  },
  {
    "code": "IXK",
    "name": "Keshod Airport",
    "city": "Keshod",
    "country": "IN"
  },
  {
    "code": "IXL",
    "name": "Leh Kushok Bakula Rimpochee Airport",
    "city": "Leh",
    "country": "IN"
  },
  {
    "code": "IXM",
    "name": "Madurai Airport",
    "city": "Madurai",
    "country": "IN"
  },
  {
    "code": "IXP",
    "name": "Pathankot Airport",
    "city": "Pathankot",
    "country": "IN"
  },
  {
    "code": "IXR",
    "name": "Birsa Munda Airport",
    "city": "Ranchi",
    "country": "IN"
  },
  {
    "code": "IXS",
    "name": "Silchar Airport",
    "city": "Silchar",
    "country": "IN"
  },
  {
    "code": "IXU",
    "name": "Aurangabad Airport",
    "city": "Aurangabad",
    "country": "IN"
  },
  {
    "code": "IXV",
    "name": "Along Airport",
    "city": null,
    "country": "IN"
  },
  {
    "code": "IXW",
    "name": "Sonari Airport",
    "city": "Jamshedpur",
    "country": "IN"
  },
  {
    "code": "IXX",
    "name": "Bidar Airport / Bidar Air Force Station",
    "city": "Bidar",
    "country": "IN"
  },
  {
    "code": "IXY",
    "name": "Kandla Airport",
    "city": "Kandla",
    "country": "IN"
  },
  {
    "code": "IXZ",
    "name": "Veer Savarkar International Airport / INS Utkrosh",
    "city": "Port Blair",
    "country": "IN"
  },
  {
    "code": "IZA",
    "name": "Presidente Itamar Franco Airport",
    "city": "Juiz de Fora",
    "country": "BR"
  },
  {
    "code": "IZO",
    "name": "Izumo Enmusubi Airport",
    "city": "Izumo",
    "country": "JP"
  },
  {
    "code": "IZT",
    "name": "General Antonio Cárdenas Rodríguez National Airport / Ixtepec Air Base",
    "city": "Ixtepec",
    "country": "MX"
  },
  {
    "code": "JAA",
    "name": "Jalalabad Airport",
    "city": "Jalalabad",
    "country": "AF"
  },
  {
    "code": "JAC",
    "name": "Jackson Hole Airport",
    "city": "Jackson",
    "country": "US"
  },
  {
    "code": "JAD",
    "name": "Perth Jandakot Airport",
    "city": "Perth",
    "country": "AU"
  },
  {
    "code": "JAE",
    "name": "Shumba Airport",
    "city": "Jaén",
    "country": "PE"
  },
  {
    "code": "JAF",
    "name": "Jaffna International Airport",
    "city": "Jaffna",
    "country": "LK"
  },
  {
    "code": "JAG",
    "name": "Shahbaz Air Base",
    "city": "Jacobabad",
    "country": "PK"
  },
  {
    "code": "JAI",
    "name": "Jaipur International Airport",
    "city": "Jaipur",
    "country": "IN"
  },
  {
    "code": "JAK",
    "name": "Jacmel Airport",
    "city": "Jacmel",
    "country": "HT"
  },
  {
    "code": "JAL",
    "name": "El Lencero Airport",
    "city": "Emiliano Zapata",
    "country": "MX"
  },
  {
    "code": "JAM",
    "name": "Bezmer Air Base",
    "city": "Bezmer",
    "country": "BG"
  },
  {
    "code": "JAN",
    "name": "Jackson-Medgar Wiley Evers International Airport",
    "city": "Jackson",
    "country": "US"
  },
  {
    "code": "JAU",
    "name": "Francisco Carle Airport",
    "city": "Jauja",
    "country": "PE"
  },
  {
    "code": "JAV",
    "name": "Ilulissat Airport",
    "city": "Ilulissat",
    "country": "GL"
  },
  {
    "code": "JAX",
    "name": "Jacksonville International Airport",
    "city": "Jacksonville",
    "country": "US"
  },
  {
    "code": "JBQ",
    "name": "La Isabela International Airport",
    "city": "La Isabela",
    "country": "DO"
  },
  {
    "code": "JBR",
    "name": "Jonesboro Municipal Airport",
    "city": "Jonesboro",
    "country": "US"
  },
  {
    "code": "JCL",
    "name": "České Budějovice South Bohemian Airport",
    "city": "České Budějovice",
    "country": "CZ"
  },
  {
    "code": "JCR",
    "name": "Jacareacanga Airport",
    "city": "Jacareacanga",
    "country": "BR"
  },
  {
    "code": "JCT",
    "name": "Kimble County Airport",
    "city": "Junction",
    "country": "US"
  },
  {
    "code": "JDF",
    "name": "Francisco de Assis Airport",
    "city": "Juiz de Fora",
    "country": "BR"
  },
  {
    "code": "JDG",
    "name": "Jeongseok Airport",
    "city": "Jeju Island",
    "country": "KR"
  },
  {
    "code": "JDH",
    "name": "Jodhpur Airport",
    "city": "Jodhpur",
    "country": "IN"
  },
  {
    "code": "JDZ",
    "name": "Jingdezhen Luojia Airport",
    "city": "Jingdezhen",
    "country": "CN"
  },
  {
    "code": "JED",
    "name": "King Abdulaziz International Airport",
    "city": "Jeddah",
    "country": "SA"
  },
  {
    "code": "JEE",
    "name": "Jérémie Airport",
    "city": "Carrefour Sanon",
    "country": "HT"
  },
  {
    "code": "JEG",
    "name": "Aasiaat Airport",
    "city": "Aasiaat",
    "country": "GL"
  },
  {
    "code": "JER",
    "name": "Jersey Airport",
    "city": "St. Peter",
    "country": "JE"
  },
  {
    "code": "JFK",
    "name": "John F. Kennedy International Airport",
    "city": "New York",
    "country": "US"
  },
  {
    "code": "JFN",
    "name": "Northeast Ohio Regional Airport",
    "city": "Ashtabula",
    "country": "US"
  },
  {
    "code": "JGA",
    "name": "Jamnagar Airport",
    "city": "Jamnagar",
    "country": "IN"
  },
  {
    "code": "JGD",
    "name": "Daxing'anling Elunchun Airport",
    "city": "Jiagedaqi",
    "country": "CN"
  },
  {
    "code": "JGN",
    "name": "Jiayuguan International Airport",
    "city": "Jiayuguan",
    "country": "CN"
  },
  {
    "code": "JGS",
    "name": "Jinggangshan Airport",
    "city": "Ji'an",
    "country": "CN"
  },
  {
    "code": "JHB",
    "name": "Senai International Airport",
    "city": "Johor Bahru",
    "country": "MY"
  },
  {
    "code": "JHF",
    "name": "São Paulo Catarina Executive Airport",
    "city": "São Roque",
    "country": "BR"
  },
  {
    "code": "JHG",
    "name": "Xishuangbanna Gasa International Airport",
    "city": "Jinghong (Gasa)",
    "country": "CN"
  },
  {
    "code": "JHM",
    "name": "Kapalua Airport",
    "city": "Lahaina",
    "country": "US"
  },
  {
    "code": "JHS",
    "name": "Sisimiut Airport",
    "city": "Sisimiut",
    "country": "GL"
  },
  {
    "code": "JHW",
    "name": "Chautauqua County-Jamestown Airport",
    "city": "Jamestown",
    "country": "US"
  },
  {
    "code": "JIB",
    "name": "Djibouti-Ambouli Airport",
    "city": "Djibouti City",
    "country": "DJ"
  },
  {
    "code": "JIJ",
    "name": "Gerad Wilwal International Airport",
    "city": "Jijiga",
    "country": "ET"
  },
  {
    "code": "JIM",
    "name": "Jimma Airport",
    "city": "Jimma",
    "country": "ET"
  },
  {
    "code": "JIQ",
    "name": "Qianjiang Wulingshan Airport",
    "city": "Qianjiang",
    "country": "CN"
  },
  {
    "code": "JJD",
    "name": "Comandante Ariston Pessoa Airport",
    "city": "Cruz",
    "country": "BR"
  },
  {
    "code": "JJI",
    "name": "Juanjui Airport",
    "city": "Juanjuí",
    "country": "PE"
  },
  {
    "code": "JJN",
    "name": "Quanzhou Jinjiang International Airport",
    "city": "Quanzhou",
    "country": "CN"
  },
  {
    "code": "JKG",
    "name": "Jönköping Airport",
    "city": "Jönköping",
    "country": "SE"
  },
  {
    "code": "JKH",
    "name": "Chios Island National Airport",
    "city": "Chios Island",
    "country": "GR"
  },
  {
    "code": "JKR",
    "name": "Janakpur Airport",
    "city": "Janakpur",
    "country": "NP"
  },
  {
    "code": "JLN",
    "name": "Joplin Regional Airport",
    "city": "Joplin",
    "country": "US"
  },
  {
    "code": "JLR",
    "name": "Jabalpur Airport",
    "city": "Jabalpur",
    "country": "IN"
  },
  {
    "code": "JMJ",
    "name": "Lancang Jingmai Airport",
    "city": "Pu'er (Lancang)",
    "country": "CN"
  },
  {
    "code": "JMK",
    "name": "Mykonos Island National Airport",
    "city": "Mykonos",
    "country": "GR"
  },
  {
    "code": "JMS",
    "name": "Jamestown Regional Airport",
    "city": "Jamestown",
    "country": "US"
  },
  {
    "code": "JMU",
    "name": "Jiamusi Dongjiao Airport",
    "city": "Jiamusi",
    "country": "CN"
  },
  {
    "code": "JNB",
    "name": "O.R. Tambo International Airport",
    "city": "Johannesburg",
    "country": "ZA"
  },
  {
    "code": "JNG",
    "name": "Jining Da'an Airport",
    "city": "Jining",
    "country": "CN"
  },
  {
    "code": "JNH",
    "name": "Jiaxing Airport / Jiaxing Air Base",
    "city": "Xiuzhou, Hangzhou",
    "country": "CN"
  },
  {
    "code": "JNU",
    "name": "Juneau International Airport",
    "city": "Juneau",
    "country": "US"
  },
  {
    "code": "JNZ",
    "name": "Jinzhou Bay Airport",
    "city": "Jinzhou (Linghai)",
    "country": "CN"
  },
  {
    "code": "JOE",
    "name": "Joensuu Airport",
    "city": "Joensuu",
    "country": "FI"
  },
  {
    "code": "JOG",
    "name": "Adisutjipto International Airport",
    "city": "Yogyakarta",
    "country": "ID"
  },
  {
    "code": "JOH",
    "name": "Port St Johns Airport",
    "city": "Port St Johns",
    "country": "ZA"
  },
  {
    "code": "JOI",
    "name": "Lauro Carneiro de Loyola Airport",
    "city": "Joinville",
    "country": "BR"
  },
  {
    "code": "JOK",
    "name": "Yoshkar-Ola Airport",
    "city": "Yoshkar-Ola",
    "country": "RU"
  },
  {
    "code": "JOL",
    "name": "Jolo Airport",
    "city": "Jolo",
    "country": "PH"
  },
  {
    "code": "JOS",
    "name": "Yakubu Gowon Airport",
    "city": "Jos",
    "country": "NG"
  },
  {
    "code": "JPA",
    "name": "Presidente Castro Pinto International Airport",
    "city": "João Pessoa",
    "country": "BR"
  },
  {
    "code": "JRF",
    "name": "Kalaeloa Airport",
    "city": "Kapolei",
    "country": "US"
  },
  {
    "code": "JRH",
    "name": "Jorhat Airport",
    "city": "Jorhat",
    "country": "IN"
  },
  {
    "code": "JRO",
    "name": "Kilimanjaro International Airport",
    "city": "Arusha",
    "country": "TZ"
  },
  {
    "code": "JSA",
    "name": "Jaisalmer Airport",
    "city": null,
    "country": "IN"
  },
  {
    "code": "JSH",
    "name": "Sitia Airport",
    "city": "Crete Island",
    "country": "GR"
  },
  {
    "code": "JSI",
    "name": "Skiathos Island National Airport",
    "city": "Skiathos",
    "country": "GR"
  },
  {
    "code": "JSJ",
    "name": "Jiansanjiang Shidi Airport",
    "city": "Jiansanjiang",
    "country": "CN"
  },
  {
    "code": "JSO",
    "name": "Dr. Luciano de Arruda Coelho Regional Airport",
    "city": "Sobral",
    "country": "BR"
  },
  {
    "code": "JSR",
    "name": "Jessore Airport",
    "city": "Jashore (Jessore)",
    "country": "BD"
  },
  {
    "code": "JST",
    "name": "John Murtha Johnstown Cambria County Airport",
    "city": "Johnstown",
    "country": "US"
  },
  {
    "code": "JTC",
    "name": "Bauru/Arealva–Moussa Nakhal Tobias State Airport",
    "city": "Bauru",
    "country": "BR"
  },
  {
    "code": "JTR",
    "name": "Santorini International Airport",
    "city": "Santorini Island",
    "country": "GR"
  },
  {
    "code": "JUB",
    "name": "Juba International Airport",
    "city": "Juba",
    "country": "SS"
  },
  {
    "code": "JUJ",
    "name": "Gobernador Horacio Guzman International Airport",
    "city": "San Salvador de Jujuy",
    "country": "AR"
  },
  {
    "code": "JUL",
    "name": "Inca Manco Capac International Airport",
    "city": "Juliaca",
    "country": "PE"
  },
  {
    "code": "JUZ",
    "name": "Quzhou Airport",
    "city": "Quzhou (Kezheng)",
    "country": "CN"
  },
  {
    "code": "JWA",
    "name": "Jwaneng Airport",
    "city": "Jwaneng",
    "country": "BW"
  },
  {
    "code": "JWN",
    "name": "Zanjan Airport",
    "city": "Zanjan",
    "country": "IR"
  },
  {
    "code": "JWO",
    "name": "Jungwon Air Base/Chungju Airport",
    "city": "Gimseang-ro",
    "country": "KR"
  },
  {
    "code": "JXA",
    "name": "Jixi Xingkaihu Airport",
    "city": "Jixi",
    "country": "CN"
  },
  {
    "code": "JXN",
    "name": "Jackson County Airport/Reynolds Field",
    "city": "Jackson",
    "country": "US"
  },
  {
    "code": "JYR",
    "name": "Jiroft Airport",
    "city": "Jiroft",
    "country": "IR"
  },
  {
    "code": "JYV",
    "name": "Jyväskylä Airport",
    "city": "Jyväskylän Maalaiskunta",
    "country": "FI"
  },
  {
    "code": "JZH",
    "name": "Jiuzhai Huanglong Airport",
    "city": "Ngawa (Songpan)",
    "country": "CN"
  },
  {
    "code": "KAB",
    "name": "Kariba International Airport",
    "city": "Kariba",
    "country": "ZW"
  },
  {
    "code": "KAC",
    "name": "Qamishli Airport",
    "city": "Qamishly",
    "country": "SY"
  },
  {
    "code": "KAD",
    "name": "Kaduna International Airport",
    "city": "Kaduna",
    "country": "NG"
  },
  {
    "code": "KAG",
    "name": "Gangneung Airport (K-18)",
    "city": "Gangneung",
    "country": "KR"
  },
  {
    "code": "KAI",
    "name": "Kaieteur International Airport",
    "city": "Kaieteur Falls",
    "country": "GY"
  },
  {
    "code": "KAJ",
    "name": "Kajaani Airport",
    "city": "Kajaani",
    "country": "FI"
  },
  {
    "code": "KAN",
    "name": "Mallam Aminu Kano International Airport",
    "city": "Kano",
    "country": "NG"
  },
  {
    "code": "KAO",
    "name": "Kuusamo Airport",
    "city": "Kuusamo",
    "country": "FI"
  },
  {
    "code": "KAT",
    "name": "Kaitaia Airport",
    "city": "Awanui",
    "country": "NZ"
  },
  {
    "code": "KAU",
    "name": "Kauhava Airfield",
    "city": "Kauhava",
    "country": "FI"
  },
  {
    "code": "KAW",
    "name": "Kawthoung Airport",
    "city": "Kawthoung",
    "country": "MM"
  },
  {
    "code": "KBK",
    "name": "Kushinagar International Airport",
    "city": "Kushinagar",
    "country": "IN"
  },
  {
    "code": "KBL",
    "name": "Kabul International Airport",
    "city": "Kabul",
    "country": "AF"
  },
  {
    "code": "KBP",
    "name": "Boryspil International Airport",
    "city": "Boryspil",
    "country": "UA"
  },
  {
    "code": "KBR",
    "name": "Sultan Ismail Petra Airport",
    "city": "Kota Baharu",
    "country": "MY"
  },
  {
    "code": "KBS",
    "name": "Bo Airport",
    "city": "Bo",
    "country": "SL"
  },
  {
    "code": "KBV",
    "name": "Krabi Airport",
    "city": "Krabi",
    "country": "TH"
  },
  {
    "code": "KCH",
    "name": "Kuching International Airport",
    "city": "Kuching",
    "country": "MY"
  },
  {
    "code": "KCM",
    "name": "Kahramanmaraş Airport",
    "city": "Kahramanmaraş",
    "country": "TR"
  },
  {
    "code": "KCO",
    "name": "Cengiz Topel Airport",
    "city": "Kartepe",
    "country": "TR"
  },
  {
    "code": "KCT",
    "name": "Koggala Airport",
    "city": "Galle",
    "country": "LK"
  },
  {
    "code": "KCY",
    "name": "Krasnoyarsk Cheremshanka Airport",
    "city": "Krasnoyarsk",
    "country": "RU"
  },
  {
    "code": "KCZ",
    "name": "Kochi Ryoma Airport",
    "city": "Nankoku",
    "country": "JP"
  },
  {
    "code": "KDH",
    "name": "Ahmad Shah Baba International Airport / Kandahar Airfield",
    "city": "Khvoshab",
    "country": "AF"
  },
  {
    "code": "KDL",
    "name": "Kärdla Airport",
    "city": "Kärdla",
    "country": "EE"
  },
  {
    "code": "KDM",
    "name": "Kaadedhdhoo Airport",
    "city": "Huvadhu Atoll",
    "country": "MV"
  },
  {
    "code": "KDO",
    "name": "Kadhdhoo Airport",
    "city": "Kadhdhoo",
    "country": "MV"
  },
  {
    "code": "KDT",
    "name": "Kamphaeng Saen Airport",
    "city": "Nakhon Pathom",
    "country": "TH"
  },
  {
    "code": "KDU",
    "name": "Skardu International Airport",
    "city": "Skardu",
    "country": "PK"
  },
  {
    "code": "KEF",
    "name": "Keflavik International Airport",
    "city": "Reykjavík",
    "country": "IS"
  },
  {
    "code": "KEJ",
    "name": "Alexei Leonov Kemerovo International Airport",
    "city": "Kemerovo",
    "country": "RU"
  },
  {
    "code": "KEL",
    "name": "Kiel-Holtenau Airport",
    "city": "Kiel",
    "country": "DE"
  },
  {
    "code": "KEM",
    "name": "Kemi-Tornio Airport",
    "city": "Kemi / Tornio",
    "country": "FI"
  },
  {
    "code": "KEN",
    "name": "Kenema Airport",
    "city": "Kenema",
    "country": "SL"
  },
  {
    "code": "KEP",
    "name": "Nepalgunj Airport",
    "city": "Nepalgunj",
    "country": "NP"
  },
  {
    "code": "KER",
    "name": "Ayatollah Hashemi Rafsanjani International Airport",
    "city": "Kerman",
    "country": "IR"
  },
  {
    "code": "KES",
    "name": "Kelsey Airport",
    "city": "Kelsey",
    "country": "CA"
  },
  {
    "code": "KET",
    "name": "Kengtung Airport",
    "city": "Kengtung",
    "country": "MM"
  },
  {
    "code": "KEV",
    "name": "Halli Airport",
    "city": "Jämsä",
    "country": "FI"
  },
  {
    "code": "KFS",
    "name": "Kastamonu Airport",
    "city": "Kastamonu",
    "country": "TR"
  },
  {
    "code": "KFZ",
    "name": "Kukës International Airport",
    "city": "Kukës",
    "country": "AL"
  },
  {
    "code": "KGA",
    "name": "Kananga Airport",
    "city": "Kananga",
    "country": "CD"
  },
  {
    "code": "KGC",
    "name": "Kingscote Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "KGD",
    "name": "Khrabrovo Airport",
    "city": "Kaliningrad",
    "country": "RU"
  },
  {
    "code": "KGF",
    "name": "Sary-Arka Airport",
    "city": "Karaganda",
    "country": "KZ"
  },
  {
    "code": "KGG",
    "name": "Kédougou Airport",
    "city": "Kédougou",
    "country": "SN"
  },
  {
    "code": "KGI",
    "name": "Kalgoorlie Boulder Airport",
    "city": "Broadwood",
    "country": "AU"
  },
  {
    "code": "KGJ",
    "name": "Karonga Airport",
    "city": "Karonga",
    "country": "MW"
  },
  {
    "code": "KGL",
    "name": "Kigali International Airport",
    "city": "Kigali",
    "country": "RW"
  },
  {
    "code": "KGP",
    "name": "Kogalym International Airport",
    "city": "Kogalym",
    "country": "RU"
  },
  {
    "code": "KGS",
    "name": "Kos Airport",
    "city": "Kos Island",
    "country": "GR"
  },
  {
    "code": "KGT",
    "name": "Kangding Airport",
    "city": "Garzê (Kangding)",
    "country": "CN"
  },
  {
    "code": "KGY",
    "name": "Kingaroy Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "KHD",
    "name": "Khoram Abad Airport",
    "city": null,
    "country": "IR"
  },
  {
    "code": "KHE",
    "name": "Kherson International Airport",
    "city": "Kherson",
    "country": "UA"
  },
  {
    "code": "KHG",
    "name": "Kashgar Laining International Airport",
    "city": "Kashgar",
    "country": "CN"
  },
  {
    "code": "KHH",
    "name": "Kaohsiung International Airport",
    "city": "Kaohsiung (Xiaogang)",
    "country": "TW"
  },
  {
    "code": "KHI",
    "name": "Jinnah International Airport",
    "city": "Karachi",
    "country": "PK"
  },
  {
    "code": "KHJ",
    "name": "Kauhajoki Airfield",
    "city": "Kauhajoki",
    "country": "FI"
  },
  {
    "code": "KHK",
    "name": "Khark Airport",
    "city": "Khark",
    "country": "IR"
  },
  {
    "code": "KHN",
    "name": "Nanchang Changbei International Airport",
    "city": "Nanchang",
    "country": "CN"
  },
  {
    "code": "KHS",
    "name": "Khasab Airport",
    "city": "Khasab",
    "country": "OM"
  },
  {
    "code": "KHT",
    "name": "Khost International Airport",
    "city": "Khost",
    "country": "AF"
  },
  {
    "code": "KHV",
    "name": "Khabarovsk Novy Airport",
    "city": "Khabarovsk",
    "country": "RU"
  },
  {
    "code": "KID",
    "name": "Kristianstad Airport",
    "city": "Kristianstad",
    "country": "SE"
  },
  {
    "code": "KIH",
    "name": "Kish International Airport",
    "city": "Kish Island",
    "country": "IR"
  },
  {
    "code": "KIJ",
    "name": "Niigata Airport",
    "city": "Niigata",
    "country": "JP"
  },
  {
    "code": "KIK",
    "name": "Kirkuk Air Base",
    "city": "Kirkuk",
    "country": "IQ"
  },
  {
    "code": "KIM",
    "name": "Kimberley Airport",
    "city": "Kimberley",
    "country": "ZA"
  },
  {
    "code": "KIN",
    "name": "Norman Manley International Airport",
    "city": "Kingston",
    "country": "JM"
  },
  {
    "code": "KIR",
    "name": "Kerry Airport",
    "city": "Farranfore",
    "country": "IE"
  },
  {
    "code": "KIS",
    "name": "Kisumu International Airport",
    "city": "Kisumu",
    "country": "KE"
  },
  {
    "code": "KIW",
    "name": "Southdowns Airport",
    "city": "Kitwe",
    "country": "ZM"
  },
  {
    "code": "KIX",
    "name": "Kansai International Airport",
    "city": "Osaka",
    "country": "JP"
  },
  {
    "code": "KJA",
    "name": "Krasnoyarsk International Airport",
    "city": "Krasnoyarsk",
    "country": "RU"
  },
  {
    "code": "KJB",
    "name": "Kurnool Airport",
    "city": "Orvakal",
    "country": "IN"
  },
  {
    "code": "KJH",
    "name": "Kaili Huangping Airport",
    "city": "Kaili  (Huangping)",
    "country": "CN"
  },
  {
    "code": "KJI",
    "name": "Burqin Kanas Airport",
    "city": "Burqin",
    "country": "CN"
  },
  {
    "code": "KJK",
    "name": "Flanders International Airport Kortrijk-Wevelgem",
    "city": "Wevelgem",
    "country": "BE"
  },
  {
    "code": "KJT",
    "name": "Kertajati International Airport",
    "city": "Kertajati",
    "country": "ID"
  },
  {
    "code": "KKC",
    "name": "Khon Kaen Airport",
    "city": "Khon Kaen",
    "country": "TH"
  },
  {
    "code": "KKE",
    "name": "Kerikeri Airport",
    "city": "Kerikeri",
    "country": "NZ"
  },
  {
    "code": "KKJ",
    "name": "Kitakyushu Airport",
    "city": "Kitakyushu",
    "country": "JP"
  },
  {
    "code": "KKM",
    "name": "Khok Kathiam Airport",
    "city": "Lop Buri",
    "country": "TH"
  },
  {
    "code": "KKN",
    "name": "Kirkenes Airport, Høybuktmoen",
    "city": "Kirkenes",
    "country": "NO"
  },
  {
    "code": "KKR",
    "name": "Kaukura Airport",
    "city": "Raitahiti",
    "country": "PF"
  },
  {
    "code": "KKS",
    "name": "Kashan Airport",
    "city": "Kashan",
    "country": "IR"
  },
  {
    "code": "KKW",
    "name": "Kikwit Airport",
    "city": "Kikwit",
    "country": "CD"
  },
  {
    "code": "KKX",
    "name": "Kikai Airport",
    "city": "Kikai",
    "country": "JP"
  },
  {
    "code": "KLC",
    "name": "Kaolack Airport",
    "city": "Kaolack",
    "country": "SN"
  },
  {
    "code": "KLD",
    "name": "Migalovo Air Base",
    "city": "Tver",
    "country": "RU"
  },
  {
    "code": "KLF",
    "name": "Grabtsevo Airport",
    "city": "Kaluga",
    "country": "RU"
  },
  {
    "code": "KLH",
    "name": "Kolhapur Airport",
    "city": "Kolhapur",
    "country": "IN"
  },
  {
    "code": "KLO",
    "name": "Kalibo International Airport",
    "city": "Kalibo",
    "country": "PH"
  },
  {
    "code": "KLR",
    "name": "Kalmar Airport",
    "city": "Kalmar",
    "country": "SE"
  },
  {
    "code": "KLS",
    "name": "Southwest Washington Regional Airport",
    "city": "Kelso",
    "country": "US"
  },
  {
    "code": "KLU",
    "name": "Klagenfurt Airport",
    "city": "Klagenfurt am Wörthersee",
    "country": "AT"
  },
  {
    "code": "KLV",
    "name": "Karlovy Vary Airport",
    "city": "Karlovy Vary",
    "country": "CZ"
  },
  {
    "code": "KLW",
    "name": "Klawock Airport",
    "city": "Klawock",
    "country": "US"
  },
  {
    "code": "KLX",
    "name": "Kalamata Airport",
    "city": "Kalamata",
    "country": "GR"
  },
  {
    "code": "KLZ",
    "name": "Kleinsee Airport",
    "city": "Kleinsee",
    "country": "ZA"
  },
  {
    "code": "KMA",
    "name": "Kerema Airport",
    "city": "Kerema",
    "country": "PG"
  },
  {
    "code": "KMC",
    "name": "King Khaled Military City Airport",
    "city": "King Khaled Military City",
    "country": "SA"
  },
  {
    "code": "KME",
    "name": "Kamembe Airport",
    "city": "Kamembe",
    "country": "RW"
  },
  {
    "code": "KMG",
    "name": "Kunming Changshui International Airport",
    "city": "Kunming",
    "country": "CN"
  },
  {
    "code": "KMH",
    "name": "Johan Pienaar Airport",
    "city": "Kuruman",
    "country": "ZA"
  },
  {
    "code": "KMI",
    "name": "Miyazaki Airport",
    "city": "Miyazaki",
    "country": "JP"
  },
  {
    "code": "KMJ",
    "name": "Kumamoto Airport",
    "city": "Kumamoto",
    "country": "JP"
  },
  {
    "code": "KMP",
    "name": "Keetmanshoop Airport",
    "city": "Keetmanshoop",
    "country": "NA"
  },
  {
    "code": "KMQ",
    "name": "Komatsu Airport / JASDF Komatsu Air Base",
    "city": "Kanazawa",
    "country": "JP"
  },
  {
    "code": "KMS",
    "name": "Prempeh I International Airport",
    "city": "Kumasi",
    "country": "GH"
  },
  {
    "code": "KMU",
    "name": "Kismayo Airport",
    "city": "Kismayo",
    "country": "SO"
  },
  {
    "code": "KMW",
    "name": "Kostroma Sokerkino Airport",
    "city": "Kostroma",
    "country": "RU"
  },
  {
    "code": "KMX",
    "name": "King Khalid Air Base",
    "city": "Khamis Mushait",
    "country": "SA"
  },
  {
    "code": "KNA",
    "name": "Viña del Mar Airport",
    "city": "Viña del Mar",
    "country": "CL"
  },
  {
    "code": "KND",
    "name": "Kindu Airport",
    "city": "Kindu",
    "country": "CD"
  },
  {
    "code": "KNF",
    "name": "RAF Marham",
    "city": "King's Lynn, Norfolk",
    "country": "GB"
  },
  {
    "code": "KNG",
    "name": "Utarom Airport",
    "city": "Kaimana",
    "country": "ID"
  },
  {
    "code": "KNH",
    "name": "Kinmen Airport",
    "city": "Shang-I",
    "country": "TW"
  },
  {
    "code": "KNO",
    "name": "Kualanamu International Airport",
    "city": "Beringin",
    "country": "ID"
  },
  {
    "code": "KNQ",
    "name": "Koné Airport",
    "city": "Koné",
    "country": "NC"
  },
  {
    "code": "KNR",
    "name": "Jam Airport",
    "city": "Jam",
    "country": "IR"
  },
  {
    "code": "KNS",
    "name": "King Island Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "KNU",
    "name": "Kanpur Airport",
    "city": "Kanpur",
    "country": "IN"
  },
  {
    "code": "KNX",
    "name": "East Kimberley Regional (Kununurra) Airport",
    "city": "Kununurra",
    "country": "AU"
  },
  {
    "code": "KOA",
    "name": "Ellison Onizuka Kona International Airport at Keāhole",
    "city": "Kailua-Kona",
    "country": "US"
  },
  {
    "code": "KOI",
    "name": "Kirkwall Airport",
    "city": "Kirkwall, Orkney Islands",
    "country": "GB"
  },
  {
    "code": "KOJ",
    "name": "Kagoshima Airport",
    "city": "Kagoshima",
    "country": "JP"
  },
  {
    "code": "KOK",
    "name": "Kokkola-Pietarsaari Airport",
    "city": "Kokkola / Kruunupyy",
    "country": "FI"
  },
  {
    "code": "KOP",
    "name": "Nakhon Phanom Airport",
    "city": "Nakhon Phanom",
    "country": "TH"
  },
  {
    "code": "KOS",
    "name": "Sihanouk International Airport",
    "city": "Preah Sihanouk",
    "country": "KH"
  },
  {
    "code": "KOU",
    "name": "Koulamoutou Mabimbi Airport",
    "city": "Koulamoutou",
    "country": "GA"
  },
  {
    "code": "KOV",
    "name": "Kokshetau International Airport",
    "city": "Kokshetau",
    "country": "KZ"
  },
  {
    "code": "KPC",
    "name": "Port Clarence Coast Guard Station",
    "city": "Port Clarence",
    "country": "US"
  },
  {
    "code": "KPO",
    "name": "Pohang Airport (G-815/K-3)",
    "city": "Pohang",
    "country": "KR"
  },
  {
    "code": "KPS",
    "name": "Kempsey Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "KPW",
    "name": "Keperveem Airport",
    "city": "Keperveem",
    "country": "RU"
  },
  {
    "code": "KQH",
    "name": "Kishangarh Airport Ajmer",
    "city": "Ajmer (Kishangarh)",
    "country": "IN"
  },
  {
    "code": "KQT",
    "name": "Qurghonteppa International Airport",
    "city": "Kurgan-Tyube",
    "country": "TJ"
  },
  {
    "code": "KRA",
    "name": "Kerang Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "KRF",
    "name": "Kramfors-Sollefteå Höga Kusten Airport",
    "city": "Nyland",
    "country": "SE"
  },
  {
    "code": "KRK",
    "name": "Kraków John Paul II International Airport",
    "city": "Balice",
    "country": "PL"
  },
  {
    "code": "KRL",
    "name": "Korla Licheng Airport",
    "city": "Korla",
    "country": "CN"
  },
  {
    "code": "KRN",
    "name": "Kiruna Airport",
    "city": "Kiruna",
    "country": "SE"
  },
  {
    "code": "KRO",
    "name": "Kurgan Airport",
    "city": "Kurgan",
    "country": "RU"
  },
  {
    "code": "KRP",
    "name": "Midtjyllands Airport / Air Base Karup",
    "city": "Karup",
    "country": "DK"
  },
  {
    "code": "KRR",
    "name": "Krasnodar Pashkovsky International Airport",
    "city": "Krasnodar",
    "country": "RU"
  },
  {
    "code": "KRS",
    "name": "Kristiansand Airport",
    "city": "Kristiansand(Kjevik)",
    "country": "NO"
  },
  {
    "code": "KRT",
    "name": "Khartoum International Airport",
    "city": "Khartoum",
    "country": "SD"
  },
  {
    "code": "KRW",
    "name": "Turkmenbashi International Airport",
    "city": "Turkmenbashi",
    "country": "TM"
  },
  {
    "code": "KSA",
    "name": "Kosrae International Airport",
    "city": "Okat",
    "country": "FM"
  },
  {
    "code": "KSC",
    "name": "Košice International Airport",
    "city": "Košice",
    "country": "SK"
  },
  {
    "code": "KSD",
    "name": "Karlstad Airport",
    "city": "Karlstad",
    "country": "SE"
  },
  {
    "code": "KSF",
    "name": "Kassel Airport",
    "city": "Calden",
    "country": "DE"
  },
  {
    "code": "KSH",
    "name": "Shahid Ashrafi Esfahani Airport",
    "city": "Kermanshah",
    "country": "IR"
  },
  {
    "code": "KSK",
    "name": "Karlskoga Airport",
    "city": "Karlskoga",
    "country": "SE"
  },
  {
    "code": "KSL",
    "name": "Kassala Airport",
    "city": "Kassala",
    "country": "SD"
  },
  {
    "code": "KSN",
    "name": "Kostanay International Airport",
    "city": "Kostanay",
    "country": "KZ"
  },
  {
    "code": "KSU",
    "name": "Kristiansund Airport, Kvernberget",
    "city": "Kvernberget",
    "country": "NO"
  },
  {
    "code": "KSY",
    "name": "Kars Airport",
    "city": "Kars",
    "country": "TR"
  },
  {
    "code": "KSZ",
    "name": "Kotlas Airport",
    "city": "Kotlas",
    "country": "RU"
  },
  {
    "code": "KTA",
    "name": "Karratha Airport",
    "city": "Karratha",
    "country": "AU"
  },
  {
    "code": "KTD",
    "name": "Kitadaito Airport",
    "city": "Kitadaitōjima",
    "country": "JP"
  },
  {
    "code": "KTE",
    "name": "Kerteh Airport",
    "city": "Kerteh",
    "country": "MY"
  },
  {
    "code": "KTG",
    "name": "Rahadi Osman Airport",
    "city": "Ketapang",
    "country": "ID"
  },
  {
    "code": "KTI",
    "name": "Techo International Airport",
    "city": "Phnom Penh (Boeng Khyang)",
    "country": "KH"
  },
  {
    "code": "KTL",
    "name": "Kitale Airport",
    "city": "Kitale",
    "country": "KE"
  },
  {
    "code": "KTM",
    "name": "Tribhuvan International Airport",
    "city": "Kathmandu",
    "country": "NP"
  },
  {
    "code": "KTN",
    "name": "Ketchikan International Airport",
    "city": "Ketchikan",
    "country": "US"
  },
  {
    "code": "KTP",
    "name": "Tinson Pen Airport",
    "city": "Tinson Pen",
    "country": "JM"
  },
  {
    "code": "KTQ",
    "name": "Kitee Airport",
    "city": "Kitee",
    "country": "FI"
  },
  {
    "code": "KTR",
    "name": "Tindal Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "KTT",
    "name": "Kittilä International Airport",
    "city": "Kittilä",
    "country": "FI"
  },
  {
    "code": "KTU",
    "name": "Kota Airport",
    "city": "Kota",
    "country": "IN"
  },
  {
    "code": "KTW",
    "name": "Katowice Wojciech Korfanty International Airport",
    "city": "Katowice",
    "country": "PL"
  },
  {
    "code": "KUA",
    "name": "Kuantan Airport",
    "city": "Kuantan",
    "country": "MY"
  },
  {
    "code": "KUF",
    "name": "Kurumoch International Airport",
    "city": "Samara",
    "country": "RU"
  },
  {
    "code": "KUH",
    "name": "Kushiro Airport",
    "city": "Kushiro",
    "country": "JP"
  },
  {
    "code": "KUL",
    "name": "Kuala Lumpur International Airport",
    "city": "Sepang",
    "country": "MY"
  },
  {
    "code": "KUM",
    "name": "Yakushima Airport",
    "city": "Yakushima",
    "country": "JP"
  },
  {
    "code": "KUN",
    "name": "Kaunas International Airport",
    "city": "Kaunas",
    "country": "LT"
  },
  {
    "code": "KUO",
    "name": "Kuopio Airport",
    "city": "Kuopio / Siilinjärvi",
    "country": "FI"
  },
  {
    "code": "KUS",
    "name": "Kulusuk Airport",
    "city": "Kulusuk",
    "country": "GL"
  },
  {
    "code": "KUT",
    "name": "David the Builder Kutaisi International Airport",
    "city": "Kopitnari",
    "country": "GE"
  },
  {
    "code": "KUU",
    "name": "Kullu Manali Airport",
    "city": "Bhuntar",
    "country": "IN"
  },
  {
    "code": "KUV",
    "name": "Gunsan Airport / Gunsan Air Base",
    "city": "Gunsan",
    "country": "KR"
  },
  {
    "code": "KVA",
    "name": "Kavala Alexander the Great International Airport",
    "city": "Kavala",
    "country": "GR"
  },
  {
    "code": "KVB",
    "name": "Skövde Airport",
    "city": "Skövde",
    "country": "SE"
  },
  {
    "code": "KVG",
    "name": "Kavieng Airport",
    "city": "Kavieng",
    "country": "PG"
  },
  {
    "code": "KVO",
    "name": "Morava Airport",
    "city": "Kraljevo",
    "country": "RS"
  },
  {
    "code": "KVX",
    "name": "Pobedilovo Airport",
    "city": "Kirov",
    "country": "RU"
  },
  {
    "code": "KWA",
    "name": "Bucholz Army Air Field",
    "city": "Kwajalein",
    "country": "MH"
  },
  {
    "code": "KWE",
    "name": "Guiyang Longdongbao International Airport",
    "city": "Guiyang (Nanming)",
    "country": "CN"
  },
  {
    "code": "KWG",
    "name": "Kryvyi Rih International Airport",
    "city": "Kryvyi Rih",
    "country": "UA"
  },
  {
    "code": "KWI",
    "name": "Kuwait International Airport",
    "city": "Kuwait City",
    "country": "KW"
  },
  {
    "code": "KWJ",
    "name": "Gwangju Airport",
    "city": "Gwangju",
    "country": "KR"
  },
  {
    "code": "KWL",
    "name": "Guilin Liangjiang International Airport",
    "city": "Guilin (Lingui)",
    "country": "CN"
  },
  {
    "code": "KWM",
    "name": "Kowanyama Airport",
    "city": "Kowanyama",
    "country": "AU"
  },
  {
    "code": "KWY",
    "name": "Kiwayu Airport",
    "city": "Kiwayu",
    "country": "KE"
  },
  {
    "code": "KWZ",
    "name": "Kolwezi Airport",
    "city": "Kolwezi",
    "country": "CD"
  },
  {
    "code": "KXB",
    "name": "Sangia Nibandera Airport",
    "city": "Kolaka",
    "country": "ID"
  },
  {
    "code": "KXE",
    "name": "P C Pelser Airport",
    "city": "Klerksdorp",
    "country": "ZA"
  },
  {
    "code": "KXK",
    "name": "Komsomolsk-on-Amur Airport",
    "city": "Komsomolsk-on-Amur",
    "country": "RU"
  },
  {
    "code": "KYA",
    "name": "Konya Airport",
    "city": "Konya",
    "country": "TR"
  },
  {
    "code": "KYD",
    "name": "Lanyu Airport",
    "city": "Orchid Island",
    "country": "TW"
  },
  {
    "code": "KYE",
    "name": "Rene Mouawad Air Base",
    "city": "Tripoli",
    "country": "LB"
  },
  {
    "code": "KYP",
    "name": "Kyaukpyu Airport",
    "city": "Kyaukpyu",
    "country": "MM"
  },
  {
    "code": "KYS",
    "name": "Kayes Dag Dag Airport",
    "city": "Kayes",
    "country": "ML"
  },
  {
    "code": "KYZ",
    "name": "Kyzyl Airport",
    "city": "Kyzyl",
    "country": "RU"
  },
  {
    "code": "KZI",
    "name": "Kozani National Airport Filippos",
    "city": "Kozani",
    "country": "GR"
  },
  {
    "code": "KZN",
    "name": "Kazan International Airport",
    "city": "Kazan",
    "country": "RU"
  },
  {
    "code": "KZO",
    "name": "Korkyt Ata International Airport",
    "city": "Kyzylorda",
    "country": "KZ"
  },
  {
    "code": "LAA",
    "name": "Southeast Colorado Regional Airport",
    "city": "Lamar",
    "country": "US"
  },
  {
    "code": "LAD",
    "name": "Quatro de Fevereiro International Airport",
    "city": "Luanda",
    "country": "AO"
  },
  {
    "code": "LAE",
    "name": "Nadzab Tomodachi International Airport",
    "city": "Lae",
    "country": "PG"
  },
  {
    "code": "LAF",
    "name": "Purdue University Airport",
    "city": "West Lafayette",
    "country": "US"
  },
  {
    "code": "LAI",
    "name": "Lannion Airport",
    "city": "Lannion",
    "country": "FR"
  },
  {
    "code": "LAJ",
    "name": "Lages Airport",
    "city": "Lages",
    "country": "BR"
  },
  {
    "code": "LAL",
    "name": "Lakeland Linder International Airport",
    "city": "Lakeland",
    "country": "US"
  },
  {
    "code": "LAN",
    "name": "Capital Region International Airport",
    "city": "Lansing",
    "country": "US"
  },
  {
    "code": "LAO",
    "name": "Laoag International Airport",
    "city": "Laoag City",
    "country": "PH"
  },
  {
    "code": "LAP",
    "name": "Manuel Márquez de León International Airport",
    "city": "La Paz",
    "country": "MX"
  },
  {
    "code": "LAQ",
    "name": "Al Abraq International Airport",
    "city": "Al Albraq",
    "country": "LY"
  },
  {
    "code": "LAR",
    "name": "Laramie Regional Airport",
    "city": "Laramie",
    "country": "US"
  },
  {
    "code": "LAS",
    "name": "Harry Reid International Airport",
    "city": "Las Vegas",
    "country": "US"
  },
  {
    "code": "LAU",
    "name": "Manda Airport",
    "city": "Lamu",
    "country": "KE"
  },
  {
    "code": "LAW",
    "name": "Lawton Fort Sill Regional Airport",
    "city": "Lawton",
    "country": "US"
  },
  {
    "code": "LAX",
    "name": "Los Angeles International Airport",
    "city": "Los Angeles",
    "country": "US"
  },
  {
    "code": "LAY",
    "name": "Ladysmith Airport",
    "city": "Ladysmith",
    "country": "ZA"
  },
  {
    "code": "LAZ",
    "name": "Bom Jesus da Lapa Airport",
    "city": "Bom Jesus da Lapa",
    "country": "BR"
  },
  {
    "code": "LBA",
    "name": "Leeds Bradford Airport",
    "city": "Leeds, West Yorkshire",
    "country": "GB"
  },
  {
    "code": "LBB",
    "name": "Lubbock Preston Smith International Airport",
    "city": "Lubbock",
    "country": "US"
  },
  {
    "code": "LBC",
    "name": "Lübeck Blankensee Airport",
    "city": "Lübeck",
    "country": "DE"
  },
  {
    "code": "LBD",
    "name": "Khujand International Airport",
    "city": "Khujand",
    "country": "TJ"
  },
  {
    "code": "LBE",
    "name": "Arnold Palmer Regional Airport",
    "city": "Latrobe",
    "country": "US"
  },
  {
    "code": "LBF",
    "name": "North Platte Regional Airport Lee Bird Field",
    "city": "North Platte",
    "country": "US"
  },
  {
    "code": "LBG",
    "name": "Paris-Le Bourget International Airport",
    "city": "Paris",
    "country": "FR"
  },
  {
    "code": "LBI",
    "name": "Albi Le Sequestre airport",
    "city": "Albi",
    "country": "FR"
  },
  {
    "code": "LBL",
    "name": "Liberal Mid-America Regional Airport",
    "city": "Liberal",
    "country": "US"
  },
  {
    "code": "LBQ",
    "name": "Lambarene Airport",
    "city": "Lambarene",
    "country": "GA"
  },
  {
    "code": "LBS",
    "name": "Labasa Airport",
    "city": "Labasa",
    "country": "FJ"
  },
  {
    "code": "LBT",
    "name": "Lumberton Regional Airport",
    "city": "Lumberton",
    "country": "US"
  },
  {
    "code": "LBU",
    "name": "Labuan Airport",
    "city": "Labuan",
    "country": "MY"
  },
  {
    "code": "LBV",
    "name": "Libreville Leon M'ba International Airport",
    "city": "Libreville",
    "country": "GA"
  },
  {
    "code": "LBX",
    "name": "Lubang Airport",
    "city": "Lubang",
    "country": "PH"
  },
  {
    "code": "LBY",
    "name": "La Baule-Escoublac Airport",
    "city": "La Baule-Escoublac",
    "country": "FR"
  },
  {
    "code": "LCA",
    "name": "Larnaca International Airport",
    "city": "Larnaca",
    "country": "CY"
  },
  {
    "code": "LCC",
    "name": "Lecce Galatina Air Base / Galatina Fortunato Cesari Airport",
    "city": "Galatina (LE)",
    "country": "IT"
  },
  {
    "code": "LCE",
    "name": "Golosón International Airport",
    "city": "La Ceiba",
    "country": "HN"
  },
  {
    "code": "LCG",
    "name": "A Coruña Airport",
    "city": "Culleredo",
    "country": "ES"
  },
  {
    "code": "LCH",
    "name": "Lake Charles Regional Airport",
    "city": "Lake Charles",
    "country": "US"
  },
  {
    "code": "LCJ",
    "name": "Łódź Władysław Reymont Airport",
    "city": "Łódź",
    "country": "PL"
  },
  {
    "code": "LCK",
    "name": "Rickenbacker International Airport",
    "city": "Columbus",
    "country": "US"
  },
  {
    "code": "LCX",
    "name": "Liancheng Guanzhishan Airport",
    "city": "Longyan (Liancheng)",
    "country": "CN"
  },
  {
    "code": "LCY",
    "name": "London City Airport",
    "city": "London",
    "country": "GB"
  },
  {
    "code": "LDB",
    "name": "Governor José Richa Airport",
    "city": "Londrina",
    "country": "BR"
  },
  {
    "code": "LDE",
    "name": "Tarbes-Lourdes-Pyrénées Airport",
    "city": "Tarbes/Lourdes/Pyrénées",
    "country": "FR"
  },
  {
    "code": "LDS",
    "name": "Yichun Lindu Airport",
    "city": "Yichun",
    "country": "CN"
  },
  {
    "code": "LDU",
    "name": "Lahad Datu Airport",
    "city": "Lahad Datu",
    "country": "MY"
  },
  {
    "code": "LDV",
    "name": "Landivisiau Air Base",
    "city": "Landivisiau",
    "country": "FR"
  },
  {
    "code": "LDY",
    "name": "City of Derry Airport",
    "city": "Derry, Derry and Strabane",
    "country": "GB"
  },
  {
    "code": "LEA",
    "name": "Learmonth Airport",
    "city": "Exmouth",
    "country": "AU"
  },
  {
    "code": "LEB",
    "name": "Lebanon Municipal Airport",
    "city": "Lebanon",
    "country": "US"
  },
  {
    "code": "LED",
    "name": "Pulkovo Airport",
    "city": "St. Petersburg",
    "country": "RU"
  },
  {
    "code": "LEE",
    "name": "Leesburg International Airport",
    "city": "Leesburg",
    "country": "US"
  },
  {
    "code": "LEH",
    "name": "Le Havre-Octeville Airport",
    "city": "Le Havre",
    "country": "FR"
  },
  {
    "code": "LEI",
    "name": "Almería Airport",
    "city": "Almería",
    "country": "ES"
  },
  {
    "code": "LEJ",
    "name": "Leipzig/Halle Airport",
    "city": "Schkeuditz",
    "country": "DE"
  },
  {
    "code": "LEN",
    "name": "León Int'l Airport",
    "city": "La Virgen Del Camino",
    "country": "ES"
  },
  {
    "code": "LER",
    "name": "Leinster Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "LET",
    "name": "Alfredo Vásquez Cobo International Airport",
    "city": "Leticia",
    "country": "CO"
  },
  {
    "code": "LEU",
    "name": "Pirineus - la Seu d'Urgel Airport",
    "city": "La Seu d'Urgell Pyrenees and Andorra",
    "country": "ES"
  },
  {
    "code": "LEX",
    "name": "Blue Grass Airport",
    "city": "Lexington",
    "country": "US"
  },
  {
    "code": "LEY",
    "name": "Lelystad Airport",
    "city": "Lelystad",
    "country": "NL"
  },
  {
    "code": "LFI",
    "name": "Langley Air Force Base",
    "city": "Hampton",
    "country": "US"
  },
  {
    "code": "LFK",
    "name": "Angelina County Airport",
    "city": "Lufkin",
    "country": "US"
  },
  {
    "code": "LFM",
    "name": "Lamerd Airport",
    "city": "Lamerd",
    "country": "IR"
  },
  {
    "code": "LFQ",
    "name": "Linfen Yaodu Airport",
    "city": "Linfen (Yaodu)",
    "country": "CN"
  },
  {
    "code": "LFR",
    "name": "La Fria Airport",
    "city": null,
    "country": "VE"
  },
  {
    "code": "LFT",
    "name": "Lafayette Regional Airport",
    "city": "Lafayette",
    "country": "US"
  },
  {
    "code": "LFW",
    "name": "Lomé–Tokoin International Airport",
    "city": "Lomé",
    "country": "TG"
  },
  {
    "code": "LGA",
    "name": "LaGuardia Airport",
    "city": "New York",
    "country": "US"
  },
  {
    "code": "LGB",
    "name": "Long Beach International Airport",
    "city": "Long Beach",
    "country": "US"
  },
  {
    "code": "LGG",
    "name": "Liège Airport",
    "city": "Grâce-Hollogne",
    "country": "BE"
  },
  {
    "code": "LGH",
    "name": "Leigh Creek Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "LGI",
    "name": "Deadman's Cay Airport",
    "city": "Deadman's Cay",
    "country": "BS"
  },
  {
    "code": "LGK",
    "name": "Langkawi International Airport",
    "city": "Langkawi",
    "country": "MY"
  },
  {
    "code": "LGR",
    "name": "Cochrane Airport",
    "city": "Cochrane",
    "country": "CL"
  },
  {
    "code": "LGS",
    "name": "Comodoro D.R. Salomón Airport",
    "city": "Malargue",
    "country": "AR"
  },
  {
    "code": "LGU",
    "name": "Logan-Cache Airport",
    "city": "Logan",
    "country": "US"
  },
  {
    "code": "LGW",
    "name": "London Gatwick Airport",
    "city": "London",
    "country": "GB"
  },
  {
    "code": "LHA",
    "name": "Lahr Airport",
    "city": "Lahr/Schwarzwald",
    "country": "DE"
  },
  {
    "code": "LHE",
    "name": "Allama Iqbal International Airport",
    "city": "Lahore",
    "country": "PK"
  },
  {
    "code": "LHG",
    "name": "Lightning Ridge Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "LHK",
    "name": "Guangzhou MR Air Base / Guanghua Airport",
    "city": "Xiangyang (Laohekou)",
    "country": "CN"
  },
  {
    "code": "LHN",
    "name": "Linhares Municipal Airport",
    "city": "Linhares",
    "country": "BR"
  },
  {
    "code": "LHR",
    "name": "London Heathrow Airport",
    "city": "London",
    "country": "GB"
  },
  {
    "code": "LHS",
    "name": "Las Heras Airport",
    "city": "Las Heras",
    "country": "AR"
  },
  {
    "code": "LHW",
    "name": "Lanzhou Zhongchuan International Airport",
    "city": "Lanzhou (Yongdeng)",
    "country": "CN"
  },
  {
    "code": "LIF",
    "name": "Lifou Airport",
    "city": "Lifou",
    "country": "NC"
  },
  {
    "code": "LIG",
    "name": "Limoges Airport",
    "city": "Limoges/Bellegarde",
    "country": "FR"
  },
  {
    "code": "LIH",
    "name": "Lihue Airport",
    "city": "Lihue, Kauai",
    "country": "US"
  },
  {
    "code": "LIL",
    "name": "Lille Airport",
    "city": "Lesquin",
    "country": "FR"
  },
  {
    "code": "LIM",
    "name": "Jorge Chávez International Airport",
    "city": "Lima",
    "country": "PE"
  },
  {
    "code": "LIN",
    "name": "Milano Linate Airport",
    "city": "Segrate (MI)",
    "country": "IT"
  },
  {
    "code": "LIO",
    "name": "Limon International Airport",
    "city": "Puerto Limon",
    "country": "CR"
  },
  {
    "code": "LIP",
    "name": "Lins Airport",
    "city": "Lins",
    "country": "BR"
  },
  {
    "code": "LIQ",
    "name": "Lisala Airport",
    "city": "Lisala",
    "country": "CD"
  },
  {
    "code": "LIR",
    "name": "Guanacaste Airport",
    "city": "Liberia",
    "country": "CR"
  },
  {
    "code": "LIS",
    "name": "Lisbon Humberto Delgado Airport",
    "city": "Lisbon",
    "country": "PT"
  },
  {
    "code": "LIT",
    "name": "Bill & Hillary Clinton National Airport/Adams Field",
    "city": "Little Rock",
    "country": "US"
  },
  {
    "code": "LIW",
    "name": "Loikaw Airport",
    "city": "Loikaw",
    "country": "MM"
  },
  {
    "code": "LJG",
    "name": "Lijiang Sanyi International Airport",
    "city": "Lijiang (Gucheng)",
    "country": "CN"
  },
  {
    "code": "LJN",
    "name": "Texas Gulf Coast Regional Airport",
    "city": "Angleton",
    "country": "US"
  },
  {
    "code": "LJU",
    "name": "Ljubljana Jože Pučnik Airport",
    "city": "Zgornji Brnik",
    "country": "SI"
  },
  {
    "code": "LKG",
    "name": "Lokichogio Airport",
    "city": "Lokichogio",
    "country": "KE"
  },
  {
    "code": "LKL",
    "name": "Lakselv Airport, Banak",
    "city": "Lakselv",
    "country": "NO"
  },
  {
    "code": "LKN",
    "name": "Leknes Airport",
    "city": "Leknes",
    "country": "NO"
  },
  {
    "code": "LKO",
    "name": "Chaudhary Charan Singh International Airport",
    "city": "Lucknow",
    "country": "IN"
  },
  {
    "code": "LKY",
    "name": "Lake Manyara Airport",
    "city": "Lake Manyara National Park",
    "country": "TZ"
  },
  {
    "code": "LKZ",
    "name": "RAF Lakenheath",
    "city": "Brandon, Suffolk",
    "country": "GB"
  },
  {
    "code": "LLA",
    "name": "Luleå Airport",
    "city": "Luleå",
    "country": "SE"
  },
  {
    "code": "LLC",
    "name": "Cagayan North International Airport",
    "city": "Lal-lo",
    "country": "PH"
  },
  {
    "code": "LLF",
    "name": "Yongzhou Lingling Airport",
    "city": "Yongzhou",
    "country": "CN"
  },
  {
    "code": "LLV",
    "name": "Lüliang Dawu Airport",
    "city": "Lüliang",
    "country": "CN"
  },
  {
    "code": "LLW",
    "name": "Kamuzu International Airport",
    "city": "Lumbadzi",
    "country": "MW"
  },
  {
    "code": "LME",
    "name": "Le Mans-Arnage Airport",
    "city": "Le Mans, Sarthe",
    "country": "FR"
  },
  {
    "code": "LMM",
    "name": "Valle del Fuerte International Airport",
    "city": "Los Mochis",
    "country": "MX"
  },
  {
    "code": "LMN",
    "name": "Limbang Airport",
    "city": "Limbang",
    "country": "MY"
  },
  {
    "code": "LMO",
    "name": "RAF Lossiemouth",
    "city": "Lossiemouth, Moray",
    "country": "GB"
  },
  {
    "code": "LMP",
    "name": "Lampedusa Airport",
    "city": "Lampedusa",
    "country": "IT"
  },
  {
    "code": "LMQ",
    "name": "Marsa al Brega Airport",
    "city": "Marsa al Brega",
    "country": "LY"
  },
  {
    "code": "LMR",
    "name": "Lime Acres Finsch Mine Airport",
    "city": "Lime Acres",
    "country": "ZA"
  },
  {
    "code": "LMT",
    "name": "Crater Lake-Klamath Regional Airport",
    "city": "Klamath Falls",
    "country": "US"
  },
  {
    "code": "LND",
    "name": "Hunt Field",
    "city": "Lander",
    "country": "US"
  },
  {
    "code": "LNJ",
    "name": "Lincang Boshang Airport",
    "city": "Lincang",
    "country": "CN"
  },
  {
    "code": "LNK",
    "name": "Lincoln Airport",
    "city": "Lincoln",
    "country": "US"
  },
  {
    "code": "LNL",
    "name": "Longnan Chengzhou Airport",
    "city": "Longnan (Cheng)",
    "country": "CN"
  },
  {
    "code": "LNO",
    "name": "Leonora Airport",
    "city": "Leonora",
    "country": "AU"
  },
  {
    "code": "LNS",
    "name": "Lancaster Airport",
    "city": "Lancaster",
    "country": "US"
  },
  {
    "code": "LNX",
    "name": "Smolensk North Airport",
    "city": "Smolensk",
    "country": "RU"
  },
  {
    "code": "LNY",
    "name": "Lanai Airport",
    "city": "Lanai City",
    "country": "US"
  },
  {
    "code": "LNZ",
    "name": "Linz-Hörsching Airport",
    "city": "Linz",
    "country": "AT"
  },
  {
    "code": "LOE",
    "name": "Loei Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "LOK",
    "name": "Lodwar Airport",
    "city": "Lodwar",
    "country": "KE"
  },
  {
    "code": "LOL",
    "name": "Derby Field",
    "city": "Lovelock",
    "country": "US"
  },
  {
    "code": "LOO",
    "name": "Laghouat - Molay Ahmed Medeghri Airport",
    "city": "Laghouat",
    "country": "DZ"
  },
  {
    "code": "LOP",
    "name": "Lombok International Airport",
    "city": "Mataram (Pujut, Lombok Tengah)",
    "country": "ID"
  },
  {
    "code": "LOS",
    "name": "Murtala Muhammed International Airport",
    "city": "Lagos",
    "country": "NG"
  },
  {
    "code": "LOU",
    "name": "Bowman Field",
    "city": "Louisville",
    "country": "US"
  },
  {
    "code": "LOV",
    "name": "Monclova International Airport",
    "city": "Monclova",
    "country": "MX"
  },
  {
    "code": "LOZ",
    "name": "London-Corbin Airport/Magee Field",
    "city": "London",
    "country": "US"
  },
  {
    "code": "LPA",
    "name": "Gran Canaria Airport",
    "city": "Gran Canaria Island",
    "country": "ES"
  },
  {
    "code": "LPB",
    "name": "El Alto International Airport",
    "city": "La Paz / El Alto",
    "country": "BO"
  },
  {
    "code": "LPF",
    "name": "Liupanshui Yuezhao Airport",
    "city": "Liupanshui (Zhongshan)",
    "country": "CN"
  },
  {
    "code": "LPG",
    "name": "La Plata Airport",
    "city": "La Plata",
    "country": "AR"
  },
  {
    "code": "LPI",
    "name": "Linköping City Airport",
    "city": "Linköping",
    "country": "SE"
  },
  {
    "code": "LPK",
    "name": "Lipetsk Airport",
    "city": "Lipetsk",
    "country": "RU"
  },
  {
    "code": "LPL",
    "name": "Liverpool John Lennon Airport",
    "city": "Liverpool",
    "country": "GB"
  },
  {
    "code": "LPP",
    "name": "Lappeenranta Airport",
    "city": "Lappeenranta",
    "country": "FI"
  },
  {
    "code": "LPQ",
    "name": "Luang Phabang International Airport",
    "city": "Luang Phabang",
    "country": "LA"
  },
  {
    "code": "LPT",
    "name": "Lampang Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "LPX",
    "name": "Liepāja International Airport",
    "city": "Liepāja",
    "country": "LV"
  },
  {
    "code": "LRD",
    "name": "Laredo International Airport",
    "city": "Laredo",
    "country": "US"
  },
  {
    "code": "LRE",
    "name": "Longreach Airport",
    "city": "Longreach",
    "country": "AU"
  },
  {
    "code": "LRF",
    "name": "Little Rock Air Force Base",
    "city": "Jacksonville",
    "country": "US"
  },
  {
    "code": "LRH",
    "name": "La Rochelle Île de Ré Airport",
    "city": "La Rochelle",
    "country": "FR"
  },
  {
    "code": "LRL",
    "name": "Niamtougou International Airport",
    "city": "Niamtougou",
    "country": "TG"
  },
  {
    "code": "LRM",
    "name": "Casa De Campo International Airport",
    "city": "La Romana",
    "country": "DO"
  },
  {
    "code": "LRR",
    "name": "Lar Airport",
    "city": "Lar",
    "country": "IR"
  },
  {
    "code": "LRT",
    "name": "Lorient South Brittany (Bretagne Sud) Airport",
    "city": "Lorient/Lann/Bihoué",
    "country": "FR"
  },
  {
    "code": "LRU",
    "name": "Las Cruces International Airport",
    "city": "Las Cruces",
    "country": "US"
  },
  {
    "code": "LSC",
    "name": "La Florida Airport",
    "city": "La Serena-Coquimbo",
    "country": "CL"
  },
  {
    "code": "LSE",
    "name": "La Crosse Regional Airport",
    "city": "La Crosse",
    "country": "US"
  },
  {
    "code": "LSF",
    "name": "Lawson Army Air Field",
    "city": "Fort Benning",
    "country": "US"
  },
  {
    "code": "LSH",
    "name": "Lashio Airport",
    "city": "Lashio",
    "country": "MM"
  },
  {
    "code": "LSI",
    "name": "Sumburgh Airport",
    "city": "Lerwick, Shetland",
    "country": "GB"
  },
  {
    "code": "LSL",
    "name": "Los Chiles Airport",
    "city": "Los Chiles",
    "country": "CR"
  },
  {
    "code": "LSP",
    "name": "Josefa Camejo International Airport",
    "city": "Paraguaná",
    "country": "VE"
  },
  {
    "code": "LSR",
    "name": "Alas Leuser Airport",
    "city": "Kutacane",
    "country": "ID"
  },
  {
    "code": "LST",
    "name": "Launceston Airport",
    "city": "Launceston (Western Junction)",
    "country": "AU"
  },
  {
    "code": "LSV",
    "name": "Nellis Air Force Base",
    "city": "Las Vegas",
    "country": "US"
  },
  {
    "code": "LSX",
    "name": "Lhok Sukon Airport",
    "city": "Lhok Sukon-Sumatra Island",
    "country": "ID"
  },
  {
    "code": "LSY",
    "name": "Lismore Airport",
    "city": "Lismore",
    "country": "AU"
  },
  {
    "code": "LTA",
    "name": "Tzaneen Airport",
    "city": "Tzaneen",
    "country": "ZA"
  },
  {
    "code": "LTD",
    "name": "Ghadames East Airport",
    "city": "Ghadames",
    "country": "LY"
  },
  {
    "code": "LTH",
    "name": "Long Thanh International Airport (Under Construction)",
    "city": "Ho Chi Minh City (Long Thanh)",
    "country": "VN"
  },
  {
    "code": "LTI",
    "name": "Altai Airport",
    "city": "Altai",
    "country": "MN"
  },
  {
    "code": "LTK",
    "name": "Hmeimim Air Base",
    "city": "Latakia",
    "country": "SY"
  },
  {
    "code": "LTM",
    "name": "Lethem Airport",
    "city": "Lethem",
    "country": "GY"
  },
  {
    "code": "LTN",
    "name": "London Luton Airport",
    "city": "Luton, Bedfordshire",
    "country": "GB"
  },
  {
    "code": "LTO",
    "name": "Loreto International Airport",
    "city": "Loreto",
    "country": "MX"
  },
  {
    "code": "LTQ",
    "name": "Le Touquet-Côte d'Opale Airport",
    "city": "Le Touquet-Paris-Plage",
    "country": "FR"
  },
  {
    "code": "LTS",
    "name": "Altus Air Force Base",
    "city": "Altus",
    "country": "US"
  },
  {
    "code": "LTU",
    "name": "Murod Kond Airport",
    "city": "Latur",
    "country": "IN"
  },
  {
    "code": "LTX",
    "name": "Cotopaxi International Airport",
    "city": "Latacunga",
    "country": "EC"
  },
  {
    "code": "LUD",
    "name": "Luderitz Airport",
    "city": "Luderitz",
    "country": "NA"
  },
  {
    "code": "LUF",
    "name": "Luke Air Force Base",
    "city": "Glendale",
    "country": "US"
  },
  {
    "code": "LUG",
    "name": "Lugano Airport",
    "city": "Agno",
    "country": "CH"
  },
  {
    "code": "LUH",
    "name": "Ludhiana Airport",
    "city": null,
    "country": "IN"
  },
  {
    "code": "LUK",
    "name": "Cincinnati Municipal Airport Lunken Field",
    "city": "Cincinnati",
    "country": "US"
  },
  {
    "code": "LUM",
    "name": "Dehong Mangshi International Airport",
    "city": "Dehong (Mangshi)",
    "country": "CN"
  },
  {
    "code": "LUN",
    "name": "Kenneth Kaunda International Airport",
    "city": "Lusaka",
    "country": "ZM"
  },
  {
    "code": "LUO",
    "name": "Luena Airport",
    "city": "Luena",
    "country": "AO"
  },
  {
    "code": "LUQ",
    "name": "Brigadier Mayor D Cesar Raul Ojeda Airport",
    "city": "San Luis",
    "country": "AR"
  },
  {
    "code": "LUR",
    "name": "Cape Lisburne LRRS Airport",
    "city": "Cape Lisburne",
    "country": "US"
  },
  {
    "code": "LUV",
    "name": "Karel Sadsuitubun Airport",
    "city": "Langgur",
    "country": "ID"
  },
  {
    "code": "LUW",
    "name": "Syukuran Aminuddin Amir Airport",
    "city": "Luwok",
    "country": "ID"
  },
  {
    "code": "LUX",
    "name": "Luxembourg-Findel International Airport",
    "city": "Luxembourg",
    "country": "LU"
  },
  {
    "code": "LUZ",
    "name": "Lublin Airport",
    "city": "Lublin",
    "country": "PL"
  },
  {
    "code": "LVA",
    "name": "Laval-Entrammes Airport",
    "city": "Laval, Mayenne",
    "country": "FR"
  },
  {
    "code": "LVI",
    "name": "Harry Mwanga Nkumbula International Airport",
    "city": "Livingstone",
    "country": "ZM"
  },
  {
    "code": "LVM",
    "name": "Mission Field",
    "city": "Livingston",
    "country": "US"
  },
  {
    "code": "LVP",
    "name": "Lavan Airport",
    "city": "Lavan Airport",
    "country": "IR"
  },
  {
    "code": "LVS",
    "name": "Las Vegas Municipal Airport",
    "city": "Las Vegas",
    "country": "US"
  },
  {
    "code": "LWB",
    "name": "Greenbrier Valley Airport",
    "city": "Lewisburg",
    "country": "US"
  },
  {
    "code": "LWM",
    "name": "Lawrence Municipal Airport",
    "city": "Lawrence",
    "country": "US"
  },
  {
    "code": "LWN",
    "name": "Shirak International Airport",
    "city": "Gyumri",
    "country": "AM"
  },
  {
    "code": "LWO",
    "name": "Lviv International Airport",
    "city": "Lviv",
    "country": "UA"
  },
  {
    "code": "LWR",
    "name": "Leeuwarden Air Base",
    "city": "Leeuwarden",
    "country": "NL"
  },
  {
    "code": "LWS",
    "name": "Lewiston Nez Perce County Airport",
    "city": "Lewiston",
    "country": "US"
  },
  {
    "code": "LWT",
    "name": "Lewistown Municipal Airport",
    "city": "Lewistown",
    "country": "US"
  },
  {
    "code": "LXA",
    "name": "Lhasa Gonggar International Airport",
    "city": "Shannan (Gonggar)",
    "country": "CN"
  },
  {
    "code": "LXR",
    "name": "Luxor International Airport",
    "city": "Luxor",
    "country": "EG"
  },
  {
    "code": "LYA",
    "name": "Luoyang Beijiao Airport",
    "city": "Luoyang (Laocheng)",
    "country": "CN"
  },
  {
    "code": "LYB",
    "name": "Edward Bodden Little Cayman Airfield",
    "city": "Blossom Village",
    "country": "KY"
  },
  {
    "code": "LYC",
    "name": "Lycksele Airport",
    "city": "Lycksele",
    "country": "SE"
  },
  {
    "code": "LYG",
    "name": "Lianyungang Huaguoshan International Airport",
    "city": "Lianyungang",
    "country": "CN"
  },
  {
    "code": "LYH",
    "name": "Lynchburg Regional Airport - Preston Glenn Field",
    "city": "Lynchburg",
    "country": "US"
  },
  {
    "code": "LYI",
    "name": "Linyi Qiyang Airport",
    "city": "Linyi (Hedong)",
    "country": "CN"
  },
  {
    "code": "LYN",
    "name": "Lyon Bron Airport",
    "city": "Chassieu, Lyon",
    "country": "FR"
  },
  {
    "code": "LYP",
    "name": "Faisalabad International Airport",
    "city": "Faisalabad",
    "country": "PK"
  },
  {
    "code": "LYR",
    "name": "Svalbard Airport",
    "city": "Longyearbyen",
    "country": "NO"
  },
  {
    "code": "LYS",
    "name": "Lyon Saint-Exupéry Airport",
    "city": "Colombier-Saugnieu, Rhône",
    "country": "FR"
  },
  {
    "code": "LYU",
    "name": "Ely Municipal Airport",
    "city": "Ely",
    "country": "US"
  },
  {
    "code": "LYX",
    "name": "Lydd London Ashford Airport",
    "city": "Romney Marsh, Kent",
    "country": "GB"
  },
  {
    "code": "LZC",
    "name": "Lázaro Cárdenas Airport",
    "city": "Lázaro Cárdenas",
    "country": "MX"
  },
  {
    "code": "LZG",
    "name": "Langzhong Gucheng Airport",
    "city": "Nanchong (Langzhong)",
    "country": "CN"
  },
  {
    "code": "LZH",
    "name": "Liuzhou Bailian Airport / Bailian Air Base",
    "city": "Liuzhou (Liujiang)",
    "country": "CN"
  },
  {
    "code": "LZN",
    "name": "Matsu Nangan Airport",
    "city": "Matsu (Nangan)",
    "country": "TW"
  },
  {
    "code": "LZO",
    "name": "Luzhou Yunlong Airport",
    "city": "Luzhou (Yunlong)",
    "country": "CN"
  },
  {
    "code": "LZY",
    "name": "Nyingchi Mainling Airport",
    "city": "Nyingchi (Mainling)",
    "country": "CN"
  },
  {
    "code": "MAA",
    "name": "Chennai International Airport",
    "city": "Chennai",
    "country": "IN"
  },
  {
    "code": "MAB",
    "name": "João Correa da Rocha Airport",
    "city": "Marabá",
    "country": "BR"
  },
  {
    "code": "MAD",
    "name": "Adolfo Suárez Madrid–Barajas Airport",
    "city": "Madrid",
    "country": "ES"
  },
  {
    "code": "MAF",
    "name": "Midland International Air and Space Port",
    "city": "Midland",
    "country": "US"
  },
  {
    "code": "MAG",
    "name": "Madang Airport",
    "city": "Madang",
    "country": "PG"
  },
  {
    "code": "MAH",
    "name": "Menorca Airport",
    "city": "Mahón (Maó)",
    "country": "ES"
  },
  {
    "code": "MAJ",
    "name": "Marshall Islands International Airport",
    "city": "Majuro Atoll",
    "country": "MH"
  },
  {
    "code": "MAK",
    "name": "Malakal International Airport",
    "city": "Malakal",
    "country": "SS"
  },
  {
    "code": "MAM",
    "name": "General Servando Canales International Airport",
    "city": "Matamoros",
    "country": "MX"
  },
  {
    "code": "MAN",
    "name": "Manchester Airport",
    "city": "Manchester, Greater Manchester",
    "country": "GB"
  },
  {
    "code": "MAO",
    "name": "Eduardo Gomes International Airport",
    "city": "Manaus",
    "country": "BR"
  },
  {
    "code": "MAQ",
    "name": "Mae Sot Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "MAR",
    "name": "La Chinita International Airport",
    "city": "Maracaibo",
    "country": "VE"
  },
  {
    "code": "MAS",
    "name": "Momote Airport",
    "city": "Manus Island",
    "country": "PG"
  },
  {
    "code": "MAU",
    "name": "Maupiti Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "MAX",
    "name": "Ouro Sogui Airport",
    "city": "Ouro Sogui",
    "country": "SN"
  },
  {
    "code": "MAY",
    "name": "Clarence A. Bain Airport",
    "city": "Mangrove Cay",
    "country": "BS"
  },
  {
    "code": "MAZ",
    "name": "Eugenio Maria De Hostos Airport",
    "city": "Mayaguez",
    "country": "PR"
  },
  {
    "code": "MBA",
    "name": "Moi International Airport",
    "city": "Mombasa",
    "country": "KE"
  },
  {
    "code": "MBD",
    "name": "Mmabatho International Airport",
    "city": "Mafeking",
    "country": "ZA"
  },
  {
    "code": "MBE",
    "name": "Monbetsu Airport",
    "city": "Monbetsu",
    "country": "JP"
  },
  {
    "code": "MBG",
    "name": "Mobridge Municipal Airport",
    "city": "Mobridge",
    "country": "US"
  },
  {
    "code": "MBI",
    "name": "Songwe Airport",
    "city": "Mbeya",
    "country": "TZ"
  },
  {
    "code": "MBJ",
    "name": "Sangster International Airport",
    "city": "Montego Bay",
    "country": "JM"
  },
  {
    "code": "MBO",
    "name": "Mamburao Airport",
    "city": "Mamburao",
    "country": "PH"
  },
  {
    "code": "MBS",
    "name": "MBS International Airport",
    "city": "Freeland",
    "country": "US"
  },
  {
    "code": "MBT",
    "name": "Moises R. Espinosa Airport",
    "city": "Masbate",
    "country": "PH"
  },
  {
    "code": "MBW",
    "name": "Melbourne Moorabbin Airport",
    "city": "Melbourne",
    "country": "AU"
  },
  {
    "code": "MBX",
    "name": "Maribor Edvard Rusjan Airport",
    "city": "Maribor",
    "country": "SI"
  },
  {
    "code": "MCB",
    "name": "McComb-Pike County Airport / John E Lewis Field",
    "city": "McComb",
    "country": "US"
  },
  {
    "code": "MCC",
    "name": "McClellan Airfield",
    "city": "Sacramento",
    "country": "US"
  },
  {
    "code": "MCE",
    "name": "Merced Regional Macready Field",
    "city": "Merced",
    "country": "US"
  },
  {
    "code": "MCF",
    "name": "MacDill Air Force Base",
    "city": "Tampa",
    "country": "US"
  },
  {
    "code": "MCG",
    "name": "McGrath Airport",
    "city": "McGrath",
    "country": "US"
  },
  {
    "code": "MCI",
    "name": "Kansas City International Airport",
    "city": "Kansas City",
    "country": "US"
  },
  {
    "code": "MCJ",
    "name": "Jorge Isaac Airport",
    "city": "La Mina-Maicao",
    "country": "CO"
  },
  {
    "code": "MCK",
    "name": "McCook Ben Nelson Regional Airport",
    "city": "McCook",
    "country": "US"
  },
  {
    "code": "MCN",
    "name": "Middle Georgia Regional Airport",
    "city": "Macon",
    "country": "US"
  },
  {
    "code": "MCO",
    "name": "Orlando International Airport",
    "city": "Orlando",
    "country": "US"
  },
  {
    "code": "MCP",
    "name": "Macapá - Alberto Alcolumbre International Airport",
    "city": "Macapá",
    "country": "BR"
  },
  {
    "code": "MCS",
    "name": "Monte Caseros Airport",
    "city": "Monte Caseros",
    "country": "AR"
  },
  {
    "code": "MCT",
    "name": "Muscat International Airport",
    "city": "Muscat/Seeb",
    "country": "OM"
  },
  {
    "code": "MCU",
    "name": "Montluçon-Guéret Airport",
    "city": "Lépaud, Creuse",
    "country": "FR"
  },
  {
    "code": "MCW",
    "name": "Mason City Municipal Airport",
    "city": "Mason City",
    "country": "US"
  },
  {
    "code": "MCX",
    "name": "Makhachkala Uytash International Airport",
    "city": "Makhachkala",
    "country": "RU"
  },
  {
    "code": "MCY",
    "name": "Sunshine Coast Airport",
    "city": "Maroochydore",
    "country": "AU"
  },
  {
    "code": "MCZ",
    "name": "Zumbi dos Palmares International Airport",
    "city": "Maceió",
    "country": "BR"
  },
  {
    "code": "MDC",
    "name": "Sam Ratulangi International Airport",
    "city": "Manado",
    "country": "ID"
  },
  {
    "code": "MDE",
    "name": "Jose Maria Córdova International Airport",
    "city": "Medellín",
    "country": "CO"
  },
  {
    "code": "MDG",
    "name": "Mudanjiang Hailang International Airport",
    "city": "Mudanjiang",
    "country": "CN"
  },
  {
    "code": "MDH",
    "name": "Southern Illinois Airport",
    "city": "Murphysboro",
    "country": "US"
  },
  {
    "code": "MDI",
    "name": "Makurdi Airport",
    "city": "Makurdi",
    "country": "NG"
  },
  {
    "code": "MDK",
    "name": "Mbandaka Airport",
    "city": "Mbandaka",
    "country": "CD"
  },
  {
    "code": "MDL",
    "name": "Mandalay International Airport",
    "city": "Mandalay",
    "country": "MM"
  },
  {
    "code": "MDQ",
    "name": "Ástor Piazzola International Airport",
    "city": "Mar del Plata",
    "country": "AR"
  },
  {
    "code": "MDT",
    "name": "Harrisburg International Airport",
    "city": "Harrisburg",
    "country": "US"
  },
  {
    "code": "MDU",
    "name": "Mendi Airport",
    "city": "Mendi",
    "country": "PG"
  },
  {
    "code": "MDW",
    "name": "Chicago Midway International Airport",
    "city": "Chicago",
    "country": "US"
  },
  {
    "code": "MDY",
    "name": "Henderson Field",
    "city": "Sand Island",
    "country": "UM"
  },
  {
    "code": "MDZ",
    "name": "Governor Francisco Gabrielli International Airport",
    "city": "Mendoza",
    "country": "AR"
  },
  {
    "code": "MEA",
    "name": "Macaé Benedito Lacerda Airport",
    "city": "Macaé",
    "country": "BR"
  },
  {
    "code": "MEB",
    "name": "Melbourne Essendon Airport",
    "city": "Essendon Fields",
    "country": "AU"
  },
  {
    "code": "MEC",
    "name": "Eloy Alfaro International Airport",
    "city": "Manta",
    "country": "EC"
  },
  {
    "code": "MED",
    "name": "Prince Mohammad Bin Abdulaziz Airport",
    "city": "Medina",
    "country": "SA"
  },
  {
    "code": "MEE",
    "name": "Maré Airport",
    "city": "Maré",
    "country": "NC"
  },
  {
    "code": "MEG",
    "name": "Malanje Airport",
    "city": "Malanje",
    "country": "AO"
  },
  {
    "code": "MEH",
    "name": "Mehamn Airport",
    "city": "Mehamn",
    "country": "NO"
  },
  {
    "code": "MEI",
    "name": "Key Field / Meridian Regional Airport",
    "city": "Meridian",
    "country": "US"
  },
  {
    "code": "MEK",
    "name": "Bassatine Airport",
    "city": "Meknes",
    "country": "MA"
  },
  {
    "code": "MEL",
    "name": "Melbourne Airport",
    "city": "Melbourne",
    "country": "AU"
  },
  {
    "code": "MEM",
    "name": "Memphis International Airport",
    "city": "Memphis",
    "country": "US"
  },
  {
    "code": "MEN",
    "name": "Mende-Brenoux Airfield",
    "city": "Mende/Brénoux",
    "country": "FR"
  },
  {
    "code": "MEQ",
    "name": "Cut Nyak Dhien Airport",
    "city": "Kuala Pesisir",
    "country": "ID"
  },
  {
    "code": "MER",
    "name": "Castle Airport",
    "city": "Merced",
    "country": "US"
  },
  {
    "code": "MES",
    "name": "Soewondo Air Force Base",
    "city": "Medan",
    "country": "ID"
  },
  {
    "code": "MEU",
    "name": "Monte Dourado - Serra do Areão Airport",
    "city": "Almeirim",
    "country": "BR"
  },
  {
    "code": "MEX",
    "name": "Benito Juárez International Airport",
    "city": "Ciudad de México",
    "country": "MX"
  },
  {
    "code": "MFD",
    "name": "Mansfield Lahm Regional Airport",
    "city": "Mansfield",
    "country": "US"
  },
  {
    "code": "MFE",
    "name": "McAllen Miller International Airport",
    "city": "McAllen",
    "country": "US"
  },
  {
    "code": "MFH",
    "name": "Mesquite Airport",
    "city": "Mesquite",
    "country": "US"
  },
  {
    "code": "MFK",
    "name": "Matsu Beigan Airport",
    "city": "Matsu (Beigan)",
    "country": "TW"
  },
  {
    "code": "MFM",
    "name": "Macau International Airport",
    "city": "Nossa Senhora do Carmo",
    "country": "MO"
  },
  {
    "code": "MFQ",
    "name": "Maradi Airport",
    "city": "Maradi",
    "country": "NE"
  },
  {
    "code": "MFR",
    "name": "Rogue Valley International-Medford Airport",
    "city": "Medford",
    "country": "US"
  },
  {
    "code": "MFU",
    "name": "Mfuwe Airport",
    "city": "Mfuwe",
    "country": "ZM"
  },
  {
    "code": "MGA",
    "name": "Augusto C. Sandino (Managua) International Airport",
    "city": "Managua",
    "country": "NI"
  },
  {
    "code": "MGB",
    "name": "Mount Gambier Airport",
    "city": "Mount Gambier",
    "country": "AU"
  },
  {
    "code": "MGE",
    "name": "Dobbins Air Reserve Base",
    "city": "Marietta",
    "country": "US"
  },
  {
    "code": "MGF",
    "name": "Regional de Maringá - Sílvio Name Júnior Airport",
    "city": "Maringá",
    "country": "BR"
  },
  {
    "code": "MGH",
    "name": "Margate Airport",
    "city": "Margate",
    "country": "ZA"
  },
  {
    "code": "MGL",
    "name": "Mönchengladbach Airport",
    "city": "Mönchengladbach",
    "country": "DE"
  },
  {
    "code": "MGM",
    "name": "Montgomery Regional (Dannelly Field) Airport",
    "city": "Montgomery",
    "country": "US"
  },
  {
    "code": "MGN",
    "name": "Baracoa Airport",
    "city": "Magangué",
    "country": "CO"
  },
  {
    "code": "MGQ",
    "name": "Aden Adde International Airport",
    "city": "Mogadishu",
    "country": "SO"
  },
  {
    "code": "MGW",
    "name": "Morgantown Municipal Airport Walter L. (Bill) Hart Field",
    "city": "Morgantown",
    "country": "US"
  },
  {
    "code": "MGZ",
    "name": "Myeik Airport",
    "city": "Mkeik",
    "country": "MM"
  },
  {
    "code": "MHD",
    "name": "Mashhad International Airport",
    "city": "Mashhad",
    "country": "IR"
  },
  {
    "code": "MHG",
    "name": "Mannheim-City Airport",
    "city": "Mannheim",
    "country": "DE"
  },
  {
    "code": "MHH",
    "name": "Leonard M. Thompson International Airport",
    "city": "Marsh Harbour",
    "country": "BS"
  },
  {
    "code": "MHK",
    "name": "Manhattan Regional Airport",
    "city": "Manhattan",
    "country": "US"
  },
  {
    "code": "MHQ",
    "name": "Mariehamn Airport",
    "city": "Mariehamn",
    "country": "FI"
  },
  {
    "code": "MHR",
    "name": "Sacramento Mather Airport",
    "city": "Sacramento",
    "country": "US"
  },
  {
    "code": "MHT",
    "name": "Manchester-Boston Regional Airport",
    "city": "Manchester",
    "country": "US"
  },
  {
    "code": "MHU",
    "name": "Mount Hotham Airport",
    "city": "Mount Hotham",
    "country": "AU"
  },
  {
    "code": "MHZ",
    "name": "RAF Mildenhall",
    "city": "Bury Saint Edmunds, Suffolk",
    "country": "GB"
  },
  {
    "code": "MIA",
    "name": "Miami International Airport",
    "city": "Miami",
    "country": "US"
  },
  {
    "code": "MIB",
    "name": "Minot Air Force Base",
    "city": "Minot",
    "country": "US"
  },
  {
    "code": "MID",
    "name": "Manuel Crescencio Rejón International Airport",
    "city": "Mérida",
    "country": "MX"
  },
  {
    "code": "MIE",
    "name": "Delaware County Johnson Field",
    "city": "Muncie",
    "country": "US"
  },
  {
    "code": "MIG",
    "name": "Mianyang Nanjiao Airport",
    "city": "Mianyang (Fucheng)",
    "country": "CN"
  },
  {
    "code": "MII",
    "name": "Frank Miloye Milenkowichi–Marília State Airport",
    "city": "Marília",
    "country": "BR"
  },
  {
    "code": "MIK",
    "name": "Mikkeli Airport",
    "city": "Mikkeli",
    "country": "FI"
  },
  {
    "code": "MIM",
    "name": "Merimbula Airport",
    "city": "Merimbula",
    "country": "AU"
  },
  {
    "code": "MIR",
    "name": "Monastir Habib Bourguiba International Airport",
    "city": "Monastir",
    "country": "TN"
  },
  {
    "code": "MIU",
    "name": "Maiduguri International Airport",
    "city": "Maiduguri",
    "country": "NG"
  },
  {
    "code": "MIV",
    "name": "Millville Municipal Airport",
    "city": "Millville",
    "country": "US"
  },
  {
    "code": "MJC",
    "name": "Man Airport",
    "city": null,
    "country": "CI"
  },
  {
    "code": "MJD",
    "name": "Moenjodaro Airport",
    "city": "Moenjodaro",
    "country": "PK"
  },
  {
    "code": "MJF",
    "name": "Mosjøen Airport, Kjærstad",
    "city": "Mosjøen",
    "country": "NO"
  },
  {
    "code": "MJI",
    "name": "Mitiga International Airport",
    "city": "Tripoli",
    "country": "LY"
  },
  {
    "code": "MJK",
    "name": "Shark Bay Airport",
    "city": "Denham",
    "country": "AU"
  },
  {
    "code": "MJL",
    "name": "Mouilla Ville Airport",
    "city": "Mouila",
    "country": "GA"
  },
  {
    "code": "MJM",
    "name": "Mbuji Mayi Airport",
    "city": "Mbuji Mayi",
    "country": "CD"
  },
  {
    "code": "MJN",
    "name": "Amborovy Airport",
    "city": "Mahajanga",
    "country": "MG"
  },
  {
    "code": "MJT",
    "name": "Mytilene International Airport",
    "city": "Mytilene",
    "country": "GR"
  },
  {
    "code": "MJZ",
    "name": "Mirny Airport",
    "city": "Mirny",
    "country": "RU"
  },
  {
    "code": "MKC",
    "name": "Charles B. Wheeler Downtown Airport",
    "city": "Kansas City",
    "country": "US"
  },
  {
    "code": "MKE",
    "name": "General Mitchell International Airport",
    "city": "Milwaukee",
    "country": "US"
  },
  {
    "code": "MKG",
    "name": "Muskegon County Airport",
    "city": "Muskegon",
    "country": "US"
  },
  {
    "code": "MKK",
    "name": "Molokai Airport",
    "city": "Kaunakakai",
    "country": "US"
  },
  {
    "code": "MKL",
    "name": "McKellar-Sipes Regional Airport",
    "city": "Jackson",
    "country": "US"
  },
  {
    "code": "MKM",
    "name": "Mukah Airport",
    "city": "Mukah",
    "country": "MY"
  },
  {
    "code": "MKP",
    "name": "Makemo Airport",
    "city": "Makemo",
    "country": "PF"
  },
  {
    "code": "MKQ",
    "name": "Mopah International Airport",
    "city": "Merauke",
    "country": "ID"
  },
  {
    "code": "MKR",
    "name": "Meekatharra Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "MKU",
    "name": "Makokou Airport",
    "city": "Makokou",
    "country": "GA"
  },
  {
    "code": "MKW",
    "name": "Rendani Airport",
    "city": "Manokwari",
    "country": "ID"
  },
  {
    "code": "MKY",
    "name": "Mackay Airport",
    "city": "Mackay",
    "country": "AU"
  },
  {
    "code": "MKZ",
    "name": "Malacca International Airport",
    "city": "Malacca",
    "country": "MY"
  },
  {
    "code": "MLA",
    "name": "Malta International Airport",
    "city": "Valletta",
    "country": "MT"
  },
  {
    "code": "MLB",
    "name": "Melbourne Orlando International Airport",
    "city": "Melbourne",
    "country": "US"
  },
  {
    "code": "MLC",
    "name": "Mc Alester Regional Airport",
    "city": "Mc Alester",
    "country": "US"
  },
  {
    "code": "MLE",
    "name": "Malé International Airport",
    "city": "Malé",
    "country": "MV"
  },
  {
    "code": "MLG",
    "name": "Abdul Rachman Saleh Airport",
    "city": "Malang",
    "country": "ID"
  },
  {
    "code": "MLI",
    "name": "Quad City International Airport",
    "city": "Moline",
    "country": "US"
  },
  {
    "code": "MLM",
    "name": "General Francisco J. Mujica International Airport",
    "city": "Morelia",
    "country": "MX"
  },
  {
    "code": "MLN",
    "name": "Melilla Airport",
    "city": "Melilla",
    "country": "ES"
  },
  {
    "code": "MLS",
    "name": "Miles City Airport - Frank Wiley Field",
    "city": "Miles City",
    "country": "US"
  },
  {
    "code": "MLU",
    "name": "Monroe Regional Airport",
    "city": "Monroe",
    "country": "US"
  },
  {
    "code": "MLW",
    "name": "Spriggs Payne Airport",
    "city": "Monrovia",
    "country": "LR"
  },
  {
    "code": "MLX",
    "name": "Malatya Erhaç Airport",
    "city": "Malatya",
    "country": "TR"
  },
  {
    "code": "MMB",
    "name": "Memanbetsu Airport",
    "city": "Ōzora",
    "country": "JP"
  },
  {
    "code": "MMD",
    "name": "Minamidaito Airport",
    "city": "Minamidaito",
    "country": "JP"
  },
  {
    "code": "MME",
    "name": "Teesside International Airport",
    "city": "Darlington, Durham",
    "country": "GB"
  },
  {
    "code": "MMG",
    "name": "Mount Magnet Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "MMJ",
    "name": "Shinshu-Matsumoto Airport",
    "city": "Matsumoto",
    "country": "JP"
  },
  {
    "code": "MMK",
    "name": "Emperor Nicholas II Murmansk Airport",
    "city": "Murmansk",
    "country": "RU"
  },
  {
    "code": "MMO",
    "name": "Maio Airport",
    "city": "Vila do Maio",
    "country": "CV"
  },
  {
    "code": "MMT",
    "name": "Mc Entire Joint National Guard Base",
    "city": "Eastover",
    "country": "US"
  },
  {
    "code": "MMU",
    "name": "Morristown Municipal Airport",
    "city": "Morristown",
    "country": "US"
  },
  {
    "code": "MMX",
    "name": "Malmö Sturup Airport",
    "city": "Malmö",
    "country": "SE"
  },
  {
    "code": "MMY",
    "name": "Miyako Airport",
    "city": "Miyakojima",
    "country": "JP"
  },
  {
    "code": "MMZ",
    "name": "Maymana Zahiraddin Faryabi Airport",
    "city": "Maymana",
    "country": "AF"
  },
  {
    "code": "MNG",
    "name": "Maningrida Airport",
    "city": "Maningrida",
    "country": "AU"
  },
  {
    "code": "MNH",
    "name": "Mussanah Airport",
    "city": "Al Masna'ah",
    "country": "OM"
  },
  {
    "code": "MNI",
    "name": "John A. Osborne Airport",
    "city": "Gerald's Park",
    "country": "MS"
  },
  {
    "code": "MNJ",
    "name": "Mananjary Airport",
    "city": "Mananjary",
    "country": "MG"
  },
  {
    "code": "MNL",
    "name": "Ninoy Aquino International Airport",
    "city": "Manila (Pasay)",
    "country": "PH"
  },
  {
    "code": "MNR",
    "name": "Mongu Airport",
    "city": "Mongu",
    "country": "ZM"
  },
  {
    "code": "MNX",
    "name": "Manicoré Airport",
    "city": "Manicoré",
    "country": "BR"
  },
  {
    "code": "MNZ",
    "name": "Manassas Regional Airport/Harry P. Davis Field",
    "city": "Manassas",
    "country": "US"
  },
  {
    "code": "MOA",
    "name": "Orestes Acosta Airport",
    "city": "Moa",
    "country": "CU"
  },
  {
    "code": "MOB",
    "name": "Mobile Regional Airport",
    "city": "Mobile",
    "country": "US"
  },
  {
    "code": "MOC",
    "name": "Mário Ribeiro Airport",
    "city": "Montes Claros",
    "country": "BR"
  },
  {
    "code": "MOD",
    "name": "Modesto City Co-Harry Sham Field",
    "city": "Modesto",
    "country": "US"
  },
  {
    "code": "MOE",
    "name": "Momeik Airport",
    "city": null,
    "country": "MM"
  },
  {
    "code": "MOG",
    "name": "Mong Hsat Airport",
    "city": "Mong Hsat",
    "country": "MM"
  },
  {
    "code": "MOL",
    "name": "Molde Airport, Årø",
    "city": "Årø",
    "country": "NO"
  },
  {
    "code": "MON",
    "name": "Mount Cook Airport",
    "city": null,
    "country": "NZ"
  },
  {
    "code": "MOQ",
    "name": "Morondava Airport",
    "city": "Morondava",
    "country": "MG"
  },
  {
    "code": "MOT",
    "name": "Minot International Airport",
    "city": "Minot",
    "country": "US"
  },
  {
    "code": "MOV",
    "name": "Moranbah Airport",
    "city": "Moranbah",
    "country": "AU"
  },
  {
    "code": "MOZ",
    "name": "Moorea Temae Airport",
    "city": "Moorea-Maiao",
    "country": "PF"
  },
  {
    "code": "MPA",
    "name": "Katima Mulilo Airport",
    "city": "Mpacha",
    "country": "NA"
  },
  {
    "code": "MPH",
    "name": "Godofredo P. Ramos Airport",
    "city": "Caticlan",
    "country": "PH"
  },
  {
    "code": "MPL",
    "name": "Montpellier-Méditerranée Airport",
    "city": "Montpellier/Méditerranée",
    "country": "FR"
  },
  {
    "code": "MPM",
    "name": "Maputo Airport",
    "city": "Maputo",
    "country": "MZ"
  },
  {
    "code": "MPN",
    "name": "Mount Pleasant Airport / RAF Mount Pleasant",
    "city": "Mount Pleasant",
    "country": "FK"
  },
  {
    "code": "MPV",
    "name": "Edward F Knapp State Airport",
    "city": "Barre/Montpelier",
    "country": "US"
  },
  {
    "code": "MPW",
    "name": "Mariupol International Airport",
    "city": "Mariupol",
    "country": "UA"
  },
  {
    "code": "MQF",
    "name": "Magnitogorsk International Airport",
    "city": "Magnitogorsk",
    "country": "RU"
  },
  {
    "code": "MQH",
    "name": "Minaçu Airport",
    "city": "Minaçu",
    "country": "BR"
  },
  {
    "code": "MQJ",
    "name": "Moma Airport",
    "city": "Khonuu",
    "country": "RU"
  },
  {
    "code": "MQL",
    "name": "Mildura Airport",
    "city": "Mildura",
    "country": "AU"
  },
  {
    "code": "MQM",
    "name": "Mardin Airport",
    "city": "Mardin",
    "country": "TR"
  },
  {
    "code": "MQN",
    "name": "Mo i Rana Airport, Røssvoll",
    "city": "Mo i Rana",
    "country": "NO"
  },
  {
    "code": "MQP",
    "name": "Kruger Mpumalanga International Airport",
    "city": "Mbombela",
    "country": "ZA"
  },
  {
    "code": "MQQ",
    "name": "Moundou Airport",
    "city": "Moundou",
    "country": "TD"
  },
  {
    "code": "MQS",
    "name": "Mustique Airport",
    "city": "Lovell",
    "country": "VC"
  },
  {
    "code": "MQT",
    "name": "Marquette/Sawyer International Airport",
    "city": "Gwinn",
    "country": "US"
  },
  {
    "code": "MQU",
    "name": "Mariquita Airport",
    "city": "Mariquita",
    "country": "CO"
  },
  {
    "code": "MQX",
    "name": "Alula Aba Nega Airport",
    "city": "Mekele",
    "country": "ET"
  },
  {
    "code": "MQY",
    "name": "Smyrna Airport",
    "city": "Smyrna",
    "country": "US"
  },
  {
    "code": "MRB",
    "name": "Eastern WV Regional Airport/Shepherd Field",
    "city": "Martinsburg",
    "country": "US"
  },
  {
    "code": "MRD",
    "name": "Alberto Carnevalli Airport",
    "city": "Mérida",
    "country": "VE"
  },
  {
    "code": "MRE",
    "name": "Mara Serena Lodge Airstrip",
    "city": "Masai Mara",
    "country": "KE"
  },
  {
    "code": "MRG",
    "name": "Mareeba Airport",
    "city": "Mareeba",
    "country": "AU"
  },
  {
    "code": "MRI",
    "name": "Merrill Field",
    "city": "Anchorage",
    "country": "US"
  },
  {
    "code": "MRO",
    "name": "Hood Airport",
    "city": "Masterton",
    "country": "NZ"
  },
  {
    "code": "MRQ",
    "name": "Marinduque Airport",
    "city": "Gasan",
    "country": "PH"
  },
  {
    "code": "MRR",
    "name": "Jose Maria Velasco Ibarra Airport",
    "city": "Macará",
    "country": "EC"
  },
  {
    "code": "MRS",
    "name": "Marseille Provence Airport",
    "city": "Marignane, Bouches-du-Rhône",
    "country": "FR"
  },
  {
    "code": "MRU",
    "name": "Sir Seewoosagur Ramgoolam International Airport",
    "city": "Plaine Magnien",
    "country": "MU"
  },
  {
    "code": "MRV",
    "name": "Mineralnye Vody Airport",
    "city": "Mineralnyye Vody",
    "country": "RU"
  },
  {
    "code": "MRW",
    "name": "Lolland Falster Maribo Airport",
    "city": "Rødby",
    "country": "DK"
  },
  {
    "code": "MRX",
    "name": "Mahshahr Airport",
    "city": "Mahshahr",
    "country": "IR"
  },
  {
    "code": "MRY",
    "name": "Monterey Regional Airport",
    "city": "Monterey",
    "country": "US"
  },
  {
    "code": "MRZ",
    "name": "Moree Airport",
    "city": "Moree",
    "country": "AU"
  },
  {
    "code": "MSH",
    "name": "RAFO Masirah",
    "city": "Masirah",
    "country": "OM"
  },
  {
    "code": "MSJ",
    "name": "Misawa Airport / Misawa Air Base",
    "city": "Misawa",
    "country": "JP"
  },
  {
    "code": "MSL",
    "name": "Northwest Alabama Regional Airport",
    "city": "Muscle Shoals",
    "country": "US"
  },
  {
    "code": "MSN",
    "name": "Dane County Regional Truax Field",
    "city": "Madison",
    "country": "US"
  },
  {
    "code": "MSO",
    "name": "Missoula Montana Airport",
    "city": "Missoula",
    "country": "US"
  },
  {
    "code": "MSP",
    "name": "Minneapolis–Saint Paul International Airport / Wold–Chamberlain Field",
    "city": "Minneapolis",
    "country": "US"
  },
  {
    "code": "MSQ",
    "name": "Minsk National Airport",
    "city": "Minsk",
    "country": "BY"
  },
  {
    "code": "MSR",
    "name": "Muş Airport",
    "city": "Muş",
    "country": "TR"
  },
  {
    "code": "MSS",
    "name": "Massena International Airport Richards Field",
    "city": "Massena",
    "country": "US"
  },
  {
    "code": "MST",
    "name": "Maastricht Aachen Airport",
    "city": "Maastricht",
    "country": "NL"
  },
  {
    "code": "MSU",
    "name": "Moshoeshoe I International Airport",
    "city": "Maseru(Mazenod)",
    "country": "LS"
  },
  {
    "code": "MSW",
    "name": "Massawa International Airport",
    "city": "Massawa",
    "country": "ER"
  },
  {
    "code": "MSY",
    "name": "Louis Armstrong New Orleans International Airport",
    "city": "New Orleans",
    "country": "US"
  },
  {
    "code": "MSZ",
    "name": "Welwitschia Mirabilis International Airport",
    "city": "Moçâmedes",
    "country": "AO"
  },
  {
    "code": "MTC",
    "name": "Selfridge Air National Guard Base Airport",
    "city": "Mount Clemens",
    "country": "US"
  },
  {
    "code": "MTH",
    "name": "Florida Keys Marathon International Airport",
    "city": "Marathon",
    "country": "US"
  },
  {
    "code": "MTJ",
    "name": "Montrose Regional Airport",
    "city": "Montrose",
    "country": "US"
  },
  {
    "code": "MTN",
    "name": "Martin State Airport",
    "city": "Baltimore",
    "country": "US"
  },
  {
    "code": "MTR",
    "name": "Los Garzones Airport",
    "city": "Montería",
    "country": "CO"
  },
  {
    "code": "MTS",
    "name": "Matsapha International Airport",
    "city": "Manzini",
    "country": "SZ"
  },
  {
    "code": "MTT",
    "name": "Minatitlán/Coatzacoalcos International Airport",
    "city": "Cosoleacaque",
    "country": "MX"
  },
  {
    "code": "MTY",
    "name": "Monterrey International Airport",
    "city": "Monterrey",
    "country": "MX"
  },
  {
    "code": "MTZ",
    "name": "Bar Yehuda Airfield",
    "city": "Masada",
    "country": "IL"
  },
  {
    "code": "MUA",
    "name": "Munda Airport",
    "city": "Munda",
    "country": "SB"
  },
  {
    "code": "MUB",
    "name": "Maun International Airport",
    "city": "Maun",
    "country": "BW"
  },
  {
    "code": "MUC",
    "name": "Munich Airport",
    "city": "Munich",
    "country": "DE"
  },
  {
    "code": "MUD",
    "name": "Mueda Airport",
    "city": "Mueda",
    "country": "MZ"
  },
  {
    "code": "MUE",
    "name": "Waimea Kohala Airport",
    "city": "Waimea (Kamuela)",
    "country": "US"
  },
  {
    "code": "MUH",
    "name": "Mersa Matruh International Airport",
    "city": "Marsa Matruh",
    "country": "EG"
  },
  {
    "code": "MUI",
    "name": "Muir Army Air Field (Fort Indiantown Gap) Airport",
    "city": "Fort Indiantown Gap(Annville)",
    "country": "US"
  },
  {
    "code": "MUN",
    "name": "José Tadeo Monagas International Airport",
    "city": "Maturín",
    "country": "VE"
  },
  {
    "code": "MUO",
    "name": "Mountain Home Air Force Base",
    "city": "Mountain Home",
    "country": "US"
  },
  {
    "code": "MUR",
    "name": "Marudi Airport",
    "city": "Marudi",
    "country": "MY"
  },
  {
    "code": "MUW",
    "name": "Ghriss Airport",
    "city": "Ghriss",
    "country": "DZ"
  },
  {
    "code": "MUX",
    "name": "Multan International Airport",
    "city": "Multan",
    "country": "PK"
  },
  {
    "code": "MVB",
    "name": "M'Vengue El Hadj Omar Bongo Ondimba International Airport",
    "city": "Franceville",
    "country": "GA"
  },
  {
    "code": "MVD",
    "name": "Carrasco General Cesáreo L. Berisso International Airport",
    "city": "Ciudad de la Costa",
    "country": "UY"
  },
  {
    "code": "MVF",
    "name": "Dix-Sept Rosado Airport",
    "city": "Mossoró",
    "country": "BR"
  },
  {
    "code": "MVP",
    "name": "Fabio Alberto Leon Bentley Airport",
    "city": "Mitú",
    "country": "CO"
  },
  {
    "code": "MVQ",
    "name": "Mogilev Airport",
    "city": "Mogilev",
    "country": "BY"
  },
  {
    "code": "MVR",
    "name": "Salak Airport",
    "city": "Maroua",
    "country": "CM"
  },
  {
    "code": "MVT",
    "name": "Mataiva Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "MVZ",
    "name": "Masvingo International Airport",
    "city": "Masvingo",
    "country": "ZW"
  },
  {
    "code": "MWA",
    "name": "Veterans Airport of Southern Illinois",
    "city": "Marion",
    "country": "US"
  },
  {
    "code": "MWD",
    "name": "Mianwali Air Base",
    "city": "Mianwali",
    "country": "PK"
  },
  {
    "code": "MWE",
    "name": "Merowe Airport",
    "city": "Merowe",
    "country": "SD"
  },
  {
    "code": "MWH",
    "name": "Grant County International Airport",
    "city": "Moses Lake",
    "country": "US"
  },
  {
    "code": "MWX",
    "name": "Muan International Airport",
    "city": "Muan (Piseo-ri)",
    "country": "KR"
  },
  {
    "code": "MWZ",
    "name": "Mwanza Airport",
    "city": "Mwanza",
    "country": "TZ"
  },
  {
    "code": "MXF",
    "name": "Maxwell Air Force Base",
    "city": "Montgomery",
    "country": "US"
  },
  {
    "code": "MXI",
    "name": "Mati National Airport",
    "city": "Mati",
    "country": "PH"
  },
  {
    "code": "MXJ",
    "name": "Minna Airport",
    "city": "Minna",
    "country": "NG"
  },
  {
    "code": "MXL",
    "name": "General Rodolfo Sánchez Taboada International Airport",
    "city": "Mexicali",
    "country": "MX"
  },
  {
    "code": "MXM",
    "name": "Morombe Airport",
    "city": "Morombe",
    "country": "MG"
  },
  {
    "code": "MXN",
    "name": "Morlaix-Ploujean Airport",
    "city": "Morlaix/Ploujean",
    "country": "FR"
  },
  {
    "code": "MXP",
    "name": "Milan Malpensa International Airport",
    "city": "Ferno (VA)",
    "country": "IT"
  },
  {
    "code": "MXV",
    "name": "Mörön Airport",
    "city": "Mörön",
    "country": "MN"
  },
  {
    "code": "MXX",
    "name": "Mora Airport",
    "city": "Mora",
    "country": "SE"
  },
  {
    "code": "MYA",
    "name": "Moruya Airport",
    "city": "Moruya",
    "country": "AU"
  },
  {
    "code": "MYC",
    "name": "Escuela Mariscal Sucre Airport",
    "city": "Maracay",
    "country": "VE"
  },
  {
    "code": "MYD",
    "name": "Malindi International Airport",
    "city": "Malindi",
    "country": "KE"
  },
  {
    "code": "MYE",
    "name": "Miyakejima Airport",
    "city": "Miyakejima",
    "country": "JP"
  },
  {
    "code": "MYG",
    "name": "Mayaguana Airport",
    "city": "Abraham Bay Settlement",
    "country": "BS"
  },
  {
    "code": "MYJ",
    "name": "Matsuyama Airport",
    "city": "Matsuyama",
    "country": "JP"
  },
  {
    "code": "MYL",
    "name": "McCall Municipal Airport",
    "city": "McCall",
    "country": "US"
  },
  {
    "code": "MYP",
    "name": "Mary International Airport",
    "city": "Mary",
    "country": "TM"
  },
  {
    "code": "MYQ",
    "name": "Mysore Airport",
    "city": "Mysore",
    "country": "IN"
  },
  {
    "code": "MYR",
    "name": "Myrtle Beach International Airport",
    "city": "Myrtle Beach",
    "country": "US"
  },
  {
    "code": "MYT",
    "name": "Myitkyina Airport",
    "city": "Myitkyina",
    "country": "MM"
  },
  {
    "code": "MYU",
    "name": "Mekoryuk Airport",
    "city": "Mekoryuk",
    "country": "US"
  },
  {
    "code": "MYV",
    "name": "Yuba County Airport",
    "city": "Marysville",
    "country": "US"
  },
  {
    "code": "MYW",
    "name": "Mtwara Airport",
    "city": "Mtwara",
    "country": "TZ"
  },
  {
    "code": "MYY",
    "name": "Miri Airport",
    "city": "Miri",
    "country": "MY"
  },
  {
    "code": "MZB",
    "name": "Mocímboa da Praia Airport",
    "city": "Mocímboa da Praia",
    "country": "MZ"
  },
  {
    "code": "MZG",
    "name": "Penghu Magong Airport",
    "city": "Huxi",
    "country": "TW"
  },
  {
    "code": "MZI",
    "name": "Mopti Ambodédjo International Airport",
    "city": "Sévaré",
    "country": "ML"
  },
  {
    "code": "MZL",
    "name": "La Nubia Airport",
    "city": "Manizales",
    "country": "CO"
  },
  {
    "code": "MZO",
    "name": "Sierra Maestra International Airport",
    "city": "Manzanillo",
    "country": "CU"
  },
  {
    "code": "MZQ",
    "name": "Mkuze Airport",
    "city": "Mkuze",
    "country": "ZA"
  },
  {
    "code": "MZR",
    "name": "Mazar-i-Sharif International Airport",
    "city": "Mazar-i-Sharif",
    "country": "AF"
  },
  {
    "code": "MZS",
    "name": "Moradabad Airport",
    "city": "Moradabad",
    "country": "IN"
  },
  {
    "code": "MZT",
    "name": "General Rafael Buelna International Airport",
    "city": "Mazatlàn",
    "country": "MX"
  },
  {
    "code": "MZU",
    "name": "Muzaffarpur Airport",
    "city": "Muzaffarpur",
    "country": "IN"
  },
  {
    "code": "MZV",
    "name": "Mulu Airport",
    "city": "Mulu",
    "country": "MY"
  },
  {
    "code": "MZW",
    "name": "Mecheria Airport",
    "city": "Mecheria",
    "country": "DZ"
  },
  {
    "code": "NAA",
    "name": "Narrabri Airport",
    "city": "Narrabri",
    "country": "AU"
  },
  {
    "code": "NAG",
    "name": "Dr. Babasaheb Ambedkar International Airport",
    "city": "Nagpur",
    "country": "IN"
  },
  {
    "code": "NAH",
    "name": "Naha Airport",
    "city": "Tabukan Utara, Sangihe Islands",
    "country": "ID"
  },
  {
    "code": "NAJ",
    "name": "Nakhchivan Airport",
    "city": "Nakhchivan",
    "country": "AZ"
  },
  {
    "code": "NAK",
    "name": "Nakhon Ratchasima Airport",
    "city": "Chaloem Phra Kiat",
    "country": "TH"
  },
  {
    "code": "NAL",
    "name": "Nalchik Airport",
    "city": "Nalchik",
    "country": "RU"
  },
  {
    "code": "NAM",
    "name": "Namniwel Airport",
    "city": "Namniwel",
    "country": "ID"
  },
  {
    "code": "NAN",
    "name": "Nadi International Airport",
    "city": "Nadi",
    "country": "FJ"
  },
  {
    "code": "NAP",
    "name": "Naples International Airport",
    "city": "Napoli",
    "country": "IT"
  },
  {
    "code": "NAQ",
    "name": "Qaanaaq Airport",
    "city": "Qaanaaq",
    "country": "GL"
  },
  {
    "code": "NAS",
    "name": "Lynden Pindling International Airport",
    "city": "Nassau",
    "country": "BS"
  },
  {
    "code": "NAT",
    "name": "Rio Grande do Norte/São Gonçalo do Amarante–Governador Aluízio Alves International Airport",
    "city": "Natal",
    "country": "BR"
  },
  {
    "code": "NAW",
    "name": "Narathiwat Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "NAY",
    "name": "Beijing Nanjiao Military Airport",
    "city": "Beijing",
    "country": "CN"
  },
  {
    "code": "NBC",
    "name": "Begishevo Airport",
    "city": "Nizhnekamsk",
    "country": "RU"
  },
  {
    "code": "NBE",
    "name": "Enfidha - Hammamet International Airport",
    "city": "Enfidha",
    "country": "TN"
  },
  {
    "code": "NBG",
    "name": "New Orleans NAS JRB/Alvin Callender Field",
    "city": "New Orleans",
    "country": "US"
  },
  {
    "code": "NBJ",
    "name": "Dr. Antonio Agostinho Neto International Airport",
    "city": "Luanda (Ícolo e Bengo)",
    "country": "AO"
  },
  {
    "code": "NBO",
    "name": "Jomo Kenyatta International Airport",
    "city": "Nairobi",
    "country": "KE"
  },
  {
    "code": "NBS",
    "name": "Changbaishan Airport",
    "city": "Baishan",
    "country": "CN"
  },
  {
    "code": "NBW",
    "name": "Leeward Point Field",
    "city": "Guantanamo Bay Naval Station",
    "country": "CU"
  },
  {
    "code": "NBX",
    "name": "Douw Aturure Airport",
    "city": "Nabire",
    "country": "ID"
  },
  {
    "code": "NCA",
    "name": "North Caicos Airport",
    "city": "North Caicos",
    "country": "TC"
  },
  {
    "code": "NCE",
    "name": "Nice-Côte d'Azur Airport",
    "city": "Nice, Alpes-Maritimes",
    "country": "FR"
  },
  {
    "code": "NCL",
    "name": "Newcastle International Airport",
    "city": "Newcastle upon Tyne, Tyne and Wear",
    "country": "GB"
  },
  {
    "code": "NCO",
    "name": "Quonset State Airport",
    "city": "North Kingstown",
    "country": "US"
  },
  {
    "code": "NCS",
    "name": "Newcastle Airport",
    "city": "Newcastle",
    "country": "ZA"
  },
  {
    "code": "NCU",
    "name": "Nukus International Airport",
    "city": "Nukus",
    "country": "UZ"
  },
  {
    "code": "NCY",
    "name": "Annecy Meythet airport",
    "city": "Annecy",
    "country": "FR"
  },
  {
    "code": "NDB",
    "name": "Nouadhibou International Airport",
    "city": "Nouadhibou",
    "country": "MR"
  },
  {
    "code": "NDC",
    "name": "Nanded Airport",
    "city": "Nanded",
    "country": "IN"
  },
  {
    "code": "NDD",
    "name": "Sumbe Airport",
    "city": "Sumbe",
    "country": "AO"
  },
  {
    "code": "NDG",
    "name": "Qiqihar Sanjiazi Airport",
    "city": "Qiqihar",
    "country": "CN"
  },
  {
    "code": "NDJ",
    "name": "N'Djamena International Airport",
    "city": "N'Djamena",
    "country": "TD"
  },
  {
    "code": "NDR",
    "name": "Nador Al Aaroui International Airport",
    "city": "Al Aaroui",
    "country": "MA"
  },
  {
    "code": "NDU",
    "name": "Rundu Airport",
    "city": "Rundu",
    "country": "NA"
  },
  {
    "code": "NEC",
    "name": "Necochea Airport",
    "city": "Necochea",
    "country": "AR"
  },
  {
    "code": "NEL",
    "name": "Lakehurst Maxfield Field Airport",
    "city": "Lakehurst",
    "country": "US"
  },
  {
    "code": "NER",
    "name": "Chulman Airport",
    "city": "Neryungri",
    "country": "RU"
  },
  {
    "code": "NEU",
    "name": "Sam Neua Airport",
    "city": null,
    "country": "LA"
  },
  {
    "code": "NEV",
    "name": "Vance W. Amory International Airport",
    "city": "Charlestown",
    "country": "KN"
  },
  {
    "code": "NEW",
    "name": "Lakefront Airport",
    "city": "New Orleans",
    "country": "US"
  },
  {
    "code": "NFG",
    "name": "Nefteyugansk Airport",
    "city": "Nefteyugansk",
    "country": "RU"
  },
  {
    "code": "NFL",
    "name": "Fallon Naval Air Station",
    "city": "Fallon",
    "country": "US"
  },
  {
    "code": "NGA",
    "name": "Young Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "NGB",
    "name": "Ningbo Lishe International Airport",
    "city": "Ningbo",
    "country": "CN"
  },
  {
    "code": "NGE",
    "name": "N'Gaoundéré Airport",
    "city": "N'Gaoundéré",
    "country": "CM"
  },
  {
    "code": "NGF",
    "name": "Kaneohe Bay MCAS (Marion E. Carl Field) Airport",
    "city": "Kaneohe",
    "country": "US"
  },
  {
    "code": "NGO",
    "name": "Chubu Centrair International Airport",
    "city": "Tokoname",
    "country": "JP"
  },
  {
    "code": "NGP",
    "name": "Naval Air Station Corpus Christi Truax Field",
    "city": "Corpus Christi",
    "country": "US"
  },
  {
    "code": "NGQ",
    "name": "Ngari Gunsa Airport",
    "city": "Shiquanhe",
    "country": "CN"
  },
  {
    "code": "NGS",
    "name": "Nagasaki Airport",
    "city": "Nagasaki",
    "country": "JP"
  },
  {
    "code": "NGU",
    "name": "Norfolk Naval Station (Chambers Field)",
    "city": "Norfolk",
    "country": "US"
  },
  {
    "code": "NHD",
    "name": "Al Minhad Air Base",
    "city": "Dubai",
    "country": "AE"
  },
  {
    "code": "NHK",
    "name": "Patuxent River Naval Air Station (Trapnell Field)",
    "city": "Patuxent River",
    "country": "US"
  },
  {
    "code": "NHT",
    "name": "RAF Northolt",
    "city": "Northolt, Greater London",
    "country": "GB"
  },
  {
    "code": "NHV",
    "name": "Nuku Hiva Airport",
    "city": "Nuku Hiva",
    "country": "PF"
  },
  {
    "code": "NHZ",
    "name": "Brunswick Executive Airport",
    "city": "Brunswick",
    "country": "US"
  },
  {
    "code": "NIM",
    "name": "Diori Hamani International Airport",
    "city": "Niamey",
    "country": "NE"
  },
  {
    "code": "NIP",
    "name": "Jacksonville Naval Air Station (Towers Field)",
    "city": "Jacksonville",
    "country": "US"
  },
  {
    "code": "NIT",
    "name": "Niort - Marais Poitevin Airport",
    "city": "Niort/Souché",
    "country": "FR"
  },
  {
    "code": "NJA",
    "name": "JMSDF Atsugi Air Base / Naval Air Facility Atsugi",
    "city": "Ayase / Yamato",
    "country": "JP"
  },
  {
    "code": "NJC",
    "name": "Nizhnevartovsk Airport",
    "city": "Nizhnevartovsk",
    "country": "RU"
  },
  {
    "code": "NJF",
    "name": "Al Najaf International Airport",
    "city": "Najaf",
    "country": "IQ"
  },
  {
    "code": "NJK",
    "name": "El Centro NAF Airport (Vraciu Field)",
    "city": "El Centro",
    "country": "US"
  },
  {
    "code": "NKC",
    "name": "Nouakchott–Oumtounsy International Airport",
    "city": "Nouakchott",
    "country": "MR"
  },
  {
    "code": "NKG",
    "name": "Nanjing Lukou International Airport",
    "city": "Nanjing",
    "country": "CN"
  },
  {
    "code": "NKM",
    "name": "Nagoya Airport / JASDF Komaki Air Base",
    "city": "Nagoya",
    "country": "JP"
  },
  {
    "code": "NKT",
    "name": "Şırnak Şerafettin Elçi Airport",
    "city": "Şırnak",
    "country": "TR"
  },
  {
    "code": "NKW",
    "name": "Naval Support Facility Diego Garcia",
    "city": "Diego Garcia",
    "country": "IO"
  },
  {
    "code": "NKX",
    "name": "Miramar Marine Corps Air Station - Mitscher Field",
    "city": "San Diego",
    "country": "US"
  },
  {
    "code": "NLA",
    "name": "Simon Mwansa Kapwepwe International Airport",
    "city": "Ndola",
    "country": "ZM"
  },
  {
    "code": "NLC",
    "name": "Lemoore Naval Air Station (Reeves Field) Airport",
    "city": "Lemoore",
    "country": "US"
  },
  {
    "code": "NLD",
    "name": "Quetzalcóatl International Airport",
    "city": "Nuevo Laredo",
    "country": "MX"
  },
  {
    "code": "NLH",
    "name": "Ninglang Luguhu Airport",
    "city": "Ninglang",
    "country": "CN"
  },
  {
    "code": "NLI",
    "name": "Nikolayevsk-na-Amure Airport",
    "city": "Nikolayevsk-na-Amure Airport",
    "country": "RU"
  },
  {
    "code": "NLK",
    "name": "Norfolk Island International Airport",
    "city": "Burnt Pine",
    "country": "NF"
  },
  {
    "code": "NLO",
    "name": "Ndolo Airport",
    "city": "N'dolo",
    "country": "CD"
  },
  {
    "code": "NLT",
    "name": "Xinyuan Nalati Airport",
    "city": "Xinyuan",
    "country": "CN"
  },
  {
    "code": "NLU",
    "name": "General Felipe Ángeles International Airport",
    "city": "Mexico City",
    "country": "MX"
  },
  {
    "code": "NLV",
    "name": "Mykolaiv International Airport",
    "city": "Nikolayev",
    "country": "UA"
  },
  {
    "code": "NMA",
    "name": "Namangan International Airport",
    "city": "Namangan",
    "country": "UZ"
  },
  {
    "code": "NMB",
    "name": "Daman Airport",
    "city": "Daman",
    "country": "IN"
  },
  {
    "code": "NMC",
    "name": "Normans Cay Airport",
    "city": "Normans Cay",
    "country": "BS"
  },
  {
    "code": "NMF",
    "name": "Maafaru International Airport",
    "city": "Noonu Atoll",
    "country": "MV"
  },
  {
    "code": "NMI",
    "name": "Navi Mumbai International Airport",
    "city": "Navi Mumbai",
    "country": "IN"
  },
  {
    "code": "NMS",
    "name": "Namsang Airport",
    "city": "Namsang",
    "country": "MM"
  },
  {
    "code": "NNA",
    "name": "Kenitra Air Base",
    "city": "Kenitra",
    "country": "MA"
  },
  {
    "code": "NNG",
    "name": "Nanning Wuxu International Airport",
    "city": "Nanning (Jiangnan)",
    "country": "CN"
  },
  {
    "code": "NNM",
    "name": "Naryan Mar Airport",
    "city": "Naryan Mar",
    "country": "RU"
  },
  {
    "code": "NNT",
    "name": "Nan Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "NOA",
    "name": "Naval Air Station Nowra - HMAS Albatross",
    "city": "Nowra Hill",
    "country": "AU"
  },
  {
    "code": "NOB",
    "name": "Nosara Airport",
    "city": "Nicoya",
    "country": "CR"
  },
  {
    "code": "NOC",
    "name": "Ireland West Airport Knock",
    "city": "Charlestown",
    "country": "IE"
  },
  {
    "code": "NOG",
    "name": "Nogales International Airport",
    "city": "Nogales",
    "country": "MX"
  },
  {
    "code": "NOI",
    "name": "Krymsk Air Base",
    "city": "Krymsk",
    "country": "RU"
  },
  {
    "code": "NOJ",
    "name": "Noyabrsk Airport",
    "city": "Noyabrsk",
    "country": "RU"
  },
  {
    "code": "NOP",
    "name": "Sinop Airport",
    "city": "Sinop",
    "country": "TR"
  },
  {
    "code": "NOS",
    "name": "Nosy Be-Fascene International Airport",
    "city": "Nosy Be",
    "country": "MG"
  },
  {
    "code": "NOU",
    "name": "La Tontouta International Airport",
    "city": "Nouméa (La Tontouta)",
    "country": "NC"
  },
  {
    "code": "NOV",
    "name": "Albano Machado Airport",
    "city": "Huambo",
    "country": "AO"
  },
  {
    "code": "NOZ",
    "name": "Spichenkovo Airport",
    "city": "Novokuznetsk",
    "country": "RU"
  },
  {
    "code": "NPA",
    "name": "Naval Air Station Pensacola Forrest Sherman Field",
    "city": "Pensacola",
    "country": "US"
  },
  {
    "code": "NPE",
    "name": "Hawke's Bay Airport",
    "city": "Napier",
    "country": "NZ"
  },
  {
    "code": "NPL",
    "name": "New Plymouth Airport",
    "city": "New Plymouth",
    "country": "NZ"
  },
  {
    "code": "NPO",
    "name": "Nanga Pinoh Airport",
    "city": "Nanga Pinoh-Borneo Island",
    "country": "ID"
  },
  {
    "code": "NQA",
    "name": "Millington-Memphis Airport",
    "city": "Millington",
    "country": "US"
  },
  {
    "code": "NQI",
    "name": "Kingsville Naval Air Station",
    "city": "Kingsville",
    "country": "US"
  },
  {
    "code": "NQN",
    "name": "Presidente Peron Airport",
    "city": "Neuquen",
    "country": "AR"
  },
  {
    "code": "NQT",
    "name": "Nottingham City Airport",
    "city": "Nottingham, Nottinghamshire",
    "country": "GB"
  },
  {
    "code": "NQX",
    "name": "Naval Air Station Key West/Boca Chica Field",
    "city": "Key West",
    "country": "US"
  },
  {
    "code": "NQY",
    "name": "Cornwall Airport Newquay",
    "city": "Newquay",
    "country": "GB"
  },
  {
    "code": "NQZ",
    "name": "Nursultan Nazarbayev International Airport",
    "city": "Astana",
    "country": "KZ"
  },
  {
    "code": "NRA",
    "name": "Narrandera Airport",
    "city": "Narrandera",
    "country": "AU"
  },
  {
    "code": "NRB",
    "name": "Naval Station Mayport / Admiral David L McDonald Field",
    "city": "Jacksonville",
    "country": "US"
  },
  {
    "code": "NRK",
    "name": "Norrköping Airport",
    "city": "Norrköping",
    "country": "SE"
  },
  {
    "code": "NRN",
    "name": "Weeze (Niederrhein) Airport",
    "city": "Weeze",
    "country": "DE"
  },
  {
    "code": "NRR",
    "name": "José Aponte de la Torre Airport",
    "city": "Ceiba",
    "country": "PR"
  },
  {
    "code": "NRT",
    "name": "Narita International Airport",
    "city": "Narita",
    "country": "JP"
  },
  {
    "code": "NSE",
    "name": "Whiting Field Naval Air Station - North",
    "city": "Milton",
    "country": "US"
  },
  {
    "code": "NSH",
    "name": "Nowshahr Airport",
    "city": "Nowshahr",
    "country": "IR"
  },
  {
    "code": "NSI",
    "name": "Yaoundé Nsimalen International Airport",
    "city": "Yaoundé",
    "country": "CM"
  },
  {
    "code": "NSK",
    "name": "Alykel International Airport",
    "city": "Norilsk",
    "country": "RU"
  },
  {
    "code": "NSN",
    "name": "Nelson Airport",
    "city": "Nelson",
    "country": "NZ"
  },
  {
    "code": "NST",
    "name": "Nakhon Si Thammarat Airport",
    "city": "Nakhon Si Thammarat",
    "country": "TH"
  },
  {
    "code": "NTB",
    "name": "Notodden Airport",
    "city": "Notodden",
    "country": "NO"
  },
  {
    "code": "NTD",
    "name": "Point Mugu Naval Air Station (Naval Base Ventura Co)",
    "city": "Point Mugu",
    "country": "US"
  },
  {
    "code": "NTE",
    "name": "Nantes Atlantique Airport",
    "city": "Nantes",
    "country": "FR"
  },
  {
    "code": "NTG",
    "name": "Nantong Xingdong International Airport",
    "city": "Nantong (Tongzhou)",
    "country": "CN"
  },
  {
    "code": "NTL",
    "name": "Newcastle Airport",
    "city": "Williamtown",
    "country": "AU"
  },
  {
    "code": "NTN",
    "name": "Normanton Airport",
    "city": "Normanton",
    "country": "AU"
  },
  {
    "code": "NTQ",
    "name": "Noto Satoyama Airport",
    "city": "Wajima",
    "country": "JP"
  },
  {
    "code": "NTR",
    "name": "Del Norte International Airport",
    "city": "Monterrey",
    "country": "MX"
  },
  {
    "code": "NTU",
    "name": "Oceana Naval Air Station",
    "city": "Virginia Beach",
    "country": "US"
  },
  {
    "code": "NTX",
    "name": "Ranai Airport",
    "city": "Ranai-Natuna Besar Island",
    "country": "ID"
  },
  {
    "code": "NTY",
    "name": "Pilanesberg International Airport",
    "city": "Pilanesberg",
    "country": "ZA"
  },
  {
    "code": "NUE",
    "name": "Nuremberg Airport",
    "city": "Nuremberg",
    "country": "DE"
  },
  {
    "code": "NUI",
    "name": "Nuiqsut Airport",
    "city": "Nuiqsut",
    "country": "US"
  },
  {
    "code": "NUJ",
    "name": "Nojeh Air Base",
    "city": "Amirabad",
    "country": "IR"
  },
  {
    "code": "NUM",
    "name": "Neom Bay Airport",
    "city": "Sharma",
    "country": "SA"
  },
  {
    "code": "NUQ",
    "name": "Moffett Federal Airfield",
    "city": "Mountain View",
    "country": "US"
  },
  {
    "code": "NUW",
    "name": "Whidbey Island Naval Air Station (Ault Field)",
    "city": "Oak Harbor",
    "country": "US"
  },
  {
    "code": "NUX",
    "name": "Novy Urengoy Airport",
    "city": "Novy Urengoy",
    "country": "RU"
  },
  {
    "code": "NVA",
    "name": "Benito Salas Airport",
    "city": "Neiva",
    "country": "CO"
  },
  {
    "code": "NVI",
    "name": "Navoi International Airport",
    "city": "Navoi",
    "country": "UZ"
  },
  {
    "code": "NVS",
    "name": "Nevers-Fourchambault Airport",
    "city": "Marzy, Nièvre",
    "country": "FR"
  },
  {
    "code": "NVT",
    "name": "Ministro Victor Konder International Airport",
    "city": "Navegantes",
    "country": "BR"
  },
  {
    "code": "NWA",
    "name": "Mohéli Bandar Es Eslam Airport",
    "city": "Fomboni",
    "country": "KM"
  },
  {
    "code": "NWI",
    "name": "Norwich Airport",
    "city": "Norwich, Norfolk",
    "country": "GB"
  },
  {
    "code": "NYA",
    "name": "Nyagan Airport",
    "city": "Nyagan",
    "country": "RU"
  },
  {
    "code": "NYG",
    "name": "Quantico Marine Corps Airfield / Turner Field",
    "city": "Quantico",
    "country": "US"
  },
  {
    "code": "NYI",
    "name": "Sunyani Airport",
    "city": "Sunyani",
    "country": "GH"
  },
  {
    "code": "NYK",
    "name": "Nanyuki Airport",
    "city": "Nanyuki",
    "country": "KE"
  },
  {
    "code": "NYM",
    "name": "Nadym Airport",
    "city": "Nadym",
    "country": "RU"
  },
  {
    "code": "NYO",
    "name": "Stockholm Skavsta Airport",
    "city": "Nyköping",
    "country": "SE"
  },
  {
    "code": "NYT",
    "name": "Nay Pyi Taw International Airport",
    "city": "Naypyitaw",
    "country": "MM"
  },
  {
    "code": "NZC",
    "name": "Maria Reiche Neuman Airport",
    "city": "Nazca",
    "country": "PE"
  },
  {
    "code": "NZH",
    "name": "Manzhouli Xijiao Airport",
    "city": "Manzhouli",
    "country": "CN"
  },
  {
    "code": "NZL",
    "name": "Zhalantun Genghis Khan Airport",
    "city": "Zhalantun",
    "country": "CN"
  },
  {
    "code": "NZY",
    "name": "North Island Naval Air Station-Halsey Field",
    "city": "San Diego",
    "country": "US"
  },
  {
    "code": "OAG",
    "name": "Orange Airport",
    "city": "Orange",
    "country": "AU"
  },
  {
    "code": "OAI",
    "name": "Bagram Airfield",
    "city": "Bagram",
    "country": "AF"
  },
  {
    "code": "OAJ",
    "name": "Albert J Ellis Airport",
    "city": "Richlands",
    "country": "US"
  },
  {
    "code": "OAK",
    "name": "San Francisco Bay Oakland International Airport",
    "city": "Oakland",
    "country": "US"
  },
  {
    "code": "OAM",
    "name": "Oamaru Airport",
    "city": null,
    "country": "NZ"
  },
  {
    "code": "OAX",
    "name": "Xoxocotlán International Airport",
    "city": "Oaxaca",
    "country": "MX"
  },
  {
    "code": "OBF",
    "name": "Oberpfaffenhofen Airport",
    "city": "Weßling",
    "country": "DE"
  },
  {
    "code": "OBO",
    "name": "Tokachi-Obihiro Airport",
    "city": "Obihiro",
    "country": "JP"
  },
  {
    "code": "OBS",
    "name": "Aubenas-South Ardèche Airport",
    "city": "Lanas, Ardèche",
    "country": "FR"
  },
  {
    "code": "OCA",
    "name": "Ocean Reef Club Airport",
    "city": "Key Largo",
    "country": "US"
  },
  {
    "code": "OCC",
    "name": "Francisco De Orellana Airport",
    "city": "Coca",
    "country": "EC"
  },
  {
    "code": "OCE",
    "name": "Ocean City Municipal Airport",
    "city": "Ocean City",
    "country": "US"
  },
  {
    "code": "OCJ",
    "name": "Ian Fleming International Airport",
    "city": "Boscobel",
    "country": "JM"
  },
  {
    "code": "OCS",
    "name": "Corisco International Airport",
    "city": "Corisco Island",
    "country": "GQ"
  },
  {
    "code": "OCV",
    "name": "Aguas Claras Airport",
    "city": "Ocaña",
    "country": "CO"
  },
  {
    "code": "ODB",
    "name": "Córdoba Airport",
    "city": "Córdoba",
    "country": "ES"
  },
  {
    "code": "ODE",
    "name": "Odense Hans Christian Andersen Airport",
    "city": "Odense",
    "country": "DK"
  },
  {
    "code": "ODH",
    "name": "RAF Odiham",
    "city": "Hook, Hampshire",
    "country": "GB"
  },
  {
    "code": "ODS",
    "name": "Odessa International Airport",
    "city": "Odessa",
    "country": "UA"
  },
  {
    "code": "OEC",
    "name": "Rota Do Sândalo Oecusse Airport",
    "city": "Oecussi-Ambeno",
    "country": "TL"
  },
  {
    "code": "OER",
    "name": "Örnsköldsvik Airport",
    "city": "Örnsköldsvik",
    "country": "SE"
  },
  {
    "code": "OFF",
    "name": "Offutt Air Force Base",
    "city": "Omaha",
    "country": "US"
  },
  {
    "code": "OFK",
    "name": "Karl Stefan Memorial Airport",
    "city": "Norfolk",
    "country": "US"
  },
  {
    "code": "OGB",
    "name": "Orangeburg Municipal Airport",
    "city": "Orangeburg",
    "country": "US"
  },
  {
    "code": "OGD",
    "name": "Ogden Hinckley Airport",
    "city": "Ogden",
    "country": "US"
  },
  {
    "code": "OGG",
    "name": "Kahului International Airport",
    "city": "Kahului",
    "country": "US"
  },
  {
    "code": "OGL",
    "name": "Eugene F. Correia International Airport",
    "city": "Ogle",
    "country": "GY"
  },
  {
    "code": "OGN",
    "name": "Yonaguni Airport",
    "city": "Yonaguni",
    "country": "JP"
  },
  {
    "code": "OGS",
    "name": "Ogdensburg International Airport",
    "city": "Ogdensburg",
    "country": "US"
  },
  {
    "code": "OGU",
    "name": "Ordu–Giresun Airport",
    "city": "Ordu",
    "country": "TR"
  },
  {
    "code": "OGX",
    "name": "Ain Beida Airport",
    "city": "Ouargla",
    "country": "DZ"
  },
  {
    "code": "OGZ",
    "name": "Vladikavkaz Beslan International Airport",
    "city": "Beslan",
    "country": "RU"
  },
  {
    "code": "OHA",
    "name": "RNZAF Base Ohakea",
    "city": null,
    "country": "NZ"
  },
  {
    "code": "OHD",
    "name": "Ohrid St. Paul the Apostle Airport",
    "city": "Ohrid",
    "country": "MK"
  },
  {
    "code": "OHE",
    "name": "Mohe Gulian Airport",
    "city": "Mohe",
    "country": "CN"
  },
  {
    "code": "OHO",
    "name": "Okhotsk Airport",
    "city": "Okhotsk",
    "country": "RU"
  },
  {
    "code": "OHS",
    "name": "Suhar International Airport",
    "city": "Suhar",
    "country": "OM"
  },
  {
    "code": "OIM",
    "name": "Oshima Airport",
    "city": "Izu Oshima",
    "country": "JP"
  },
  {
    "code": "OIR",
    "name": "Okushiri Airport",
    "city": "Okushiri Island",
    "country": "JP"
  },
  {
    "code": "OIT",
    "name": "Oita Airport",
    "city": "Oita",
    "country": "JP"
  },
  {
    "code": "OKA",
    "name": "Naha International Airport",
    "city": "Naha",
    "country": "JP"
  },
  {
    "code": "OKC",
    "name": "OKC Will Rogers World Airport",
    "city": "Oklahoma City",
    "country": "US"
  },
  {
    "code": "OKD",
    "name": "Sapporo Okadama Airport",
    "city": "Sapporo",
    "country": "JP"
  },
  {
    "code": "OKE",
    "name": "Okinoerabu Airport",
    "city": "Wadomari",
    "country": "JP"
  },
  {
    "code": "OKI",
    "name": "Oki Global Geopark Airport",
    "city": "Okinoshima",
    "country": "JP"
  },
  {
    "code": "OKJ",
    "name": "Okayama Momotaro Airport",
    "city": "Okayama",
    "country": "JP"
  },
  {
    "code": "OKL",
    "name": "Oksibil Airport",
    "city": "Oksibil",
    "country": "ID"
  },
  {
    "code": "OKN",
    "name": "Okondja Airport",
    "city": "Okondja",
    "country": "GA"
  },
  {
    "code": "OKO",
    "name": "Yokota Air Base",
    "city": "Fussa",
    "country": "JP"
  },
  {
    "code": "OKY",
    "name": "Oakey Army Aviation Centre",
    "city": null,
    "country": "AU"
  },
  {
    "code": "OLA",
    "name": "Ørland Airport",
    "city": "Ørland",
    "country": "NO"
  },
  {
    "code": "OLB",
    "name": "Olbia Costa Smeralda Airport",
    "city": "Olbia (SS)",
    "country": "IT"
  },
  {
    "code": "OLF",
    "name": "L M Clayton Airport",
    "city": "Wolf Point",
    "country": "US"
  },
  {
    "code": "OLI",
    "name": "Rif Airport",
    "city": "Rif",
    "country": "IS"
  },
  {
    "code": "OLL",
    "name": "Oyo Ollombo Airport",
    "city": "Oyo",
    "country": "CG"
  },
  {
    "code": "OLM",
    "name": "Olympia Regional Airport",
    "city": "Olympia",
    "country": "US"
  },
  {
    "code": "OLS",
    "name": "Nogales International Airport",
    "city": "Nogales",
    "country": "US"
  },
  {
    "code": "OLU",
    "name": "Columbus Municipal Airport",
    "city": "Columbus",
    "country": "US"
  },
  {
    "code": "OLZ",
    "name": "Olyokminsk Airport",
    "city": "Olyokminsk",
    "country": "RU"
  },
  {
    "code": "OMA",
    "name": "Eppley Airfield",
    "city": "Omaha",
    "country": "US"
  },
  {
    "code": "OMB",
    "name": "Omboue Hospital Airport",
    "city": "Omboue",
    "country": "GA"
  },
  {
    "code": "OMC",
    "name": "Ormoc Airport",
    "city": "Ormoc City",
    "country": "PH"
  },
  {
    "code": "OMD",
    "name": "Oranjemund Airport",
    "city": "Oranjemund",
    "country": "NA"
  },
  {
    "code": "OME",
    "name": "Nome Airport",
    "city": "Nome",
    "country": "US"
  },
  {
    "code": "OMH",
    "name": "Urmia Airport",
    "city": "Urmia",
    "country": "IR"
  },
  {
    "code": "OMN",
    "name": "Zomin Airport",
    "city": "Zaamin",
    "country": "UZ"
  },
  {
    "code": "OMO",
    "name": "Mostar International Airport",
    "city": "Mostar",
    "country": "BA"
  },
  {
    "code": "OMR",
    "name": "Oradea International Airport",
    "city": "Oradea",
    "country": "RO"
  },
  {
    "code": "OMS",
    "name": "Omsk Central Airport",
    "city": "Omsk",
    "country": "RU"
  },
  {
    "code": "OND",
    "name": "Ondangwa Airport",
    "city": "Ondangwa",
    "country": "NA"
  },
  {
    "code": "ONJ",
    "name": "Odate Noshiro Airport",
    "city": "Kitaakita",
    "country": "JP"
  },
  {
    "code": "ONO",
    "name": "Ontario Municipal Airport",
    "city": "Oregon",
    "country": "US"
  },
  {
    "code": "ONP",
    "name": "Newport Municipal Airport",
    "city": "Newport",
    "country": "US"
  },
  {
    "code": "ONQ",
    "name": "Zonguldak Çaycuma Airport",
    "city": "Zonguldak",
    "country": "TR"
  },
  {
    "code": "ONT",
    "name": "Ontario International Airport",
    "city": "Ontario",
    "country": "US"
  },
  {
    "code": "ONX",
    "name": "Enrique Adolfo Jimenez Airport",
    "city": "Colón",
    "country": "PA"
  },
  {
    "code": "OOL",
    "name": "Gold Coast Airport",
    "city": "Gold Coast",
    "country": "AU"
  },
  {
    "code": "OOM",
    "name": "Cooma Snowy Mountains Airport",
    "city": "Cooma",
    "country": "AU"
  },
  {
    "code": "OPF",
    "name": "Miami-Opa Locka Executive Airport",
    "city": "Miami",
    "country": "US"
  },
  {
    "code": "OPO",
    "name": "Francisco de Sá Carneiro Airport",
    "city": "Porto",
    "country": "PT"
  },
  {
    "code": "OPU",
    "name": "Balimo Airport",
    "city": "Balimo",
    "country": "PG"
  },
  {
    "code": "ORA",
    "name": "Orán Airport",
    "city": "Orán",
    "country": "AR"
  },
  {
    "code": "ORB",
    "name": "Örebro Airport",
    "city": "Örebro",
    "country": "SE"
  },
  {
    "code": "ORD",
    "name": "Chicago O'Hare International Airport",
    "city": "Chicago",
    "country": "US"
  },
  {
    "code": "ORF",
    "name": "Norfolk International Airport",
    "city": "Norfolk",
    "country": "US"
  },
  {
    "code": "ORH",
    "name": "Worcester Regional Airport",
    "city": "Worcester",
    "country": "US"
  },
  {
    "code": "ORK",
    "name": "Cork International Airport",
    "city": "Cork",
    "country": "IE"
  },
  {
    "code": "ORL",
    "name": "Orlando Executive Airport",
    "city": "Orlando",
    "country": "US"
  },
  {
    "code": "ORN",
    "name": "Oran Es-Sénia (Ahmed Ben Bella) International Airport",
    "city": "Es-Sénia",
    "country": "DZ"
  },
  {
    "code": "ORT",
    "name": "Northway Airport",
    "city": "Northway",
    "country": "US"
  },
  {
    "code": "ORU",
    "name": "Juan Mendoza Airport",
    "city": "Oruro",
    "country": "BO"
  },
  {
    "code": "ORY",
    "name": "Paris-Orly Airport",
    "city": "Paris (Orly, Val-de-Marne)",
    "country": "FR"
  },
  {
    "code": "OSD",
    "name": "Åre Östersund Airport",
    "city": "Östersund",
    "country": "SE"
  },
  {
    "code": "OSH",
    "name": "Wittman Regional Airport",
    "city": "Oshkosh",
    "country": "US"
  },
  {
    "code": "OSI",
    "name": "Osijek Airport",
    "city": "Osijek(Klisa)",
    "country": "HR"
  },
  {
    "code": "OSL",
    "name": "Oslo-Gardermoen International Airport",
    "city": "Oslo (Gardermoen)",
    "country": "NO"
  },
  {
    "code": "OSM",
    "name": "Mosul International Airport",
    "city": "Mosul",
    "country": "IQ"
  },
  {
    "code": "OSN",
    "name": "Osan Air Base",
    "city": "Pyeongtaek",
    "country": "KR"
  },
  {
    "code": "OSR",
    "name": "Leoš Janáček Airport Ostrava",
    "city": "Mošnov",
    "country": "CZ"
  },
  {
    "code": "OSS",
    "name": "Osh International Airport",
    "city": "Osh",
    "country": "KG"
  },
  {
    "code": "OST",
    "name": "Ostend-Bruges International Airport",
    "city": "Oostende",
    "country": "BE"
  },
  {
    "code": "OSU",
    "name": "The Ohio State University Airport - Don Scott Field",
    "city": "Columbus",
    "country": "US"
  },
  {
    "code": "OSW",
    "name": "Orsk Airport",
    "city": "Orsk",
    "country": "RU"
  },
  {
    "code": "OTH",
    "name": "Southwest Oregon Regional Airport",
    "city": "North Bend",
    "country": "US"
  },
  {
    "code": "OTI",
    "name": "Pitu Airport",
    "city": "Gotalalamo-Morotai Island",
    "country": "ID"
  },
  {
    "code": "OTM",
    "name": "Ottumwa Regional Airport",
    "city": "Ottumwa",
    "country": "US"
  },
  {
    "code": "OTP",
    "name": "Bucharest Henri Coandă International Airport",
    "city": "Otopeni",
    "country": "RO"
  },
  {
    "code": "OTR",
    "name": "Coto 47 Airport",
    "city": "Corredores",
    "country": "CR"
  },
  {
    "code": "OTZ",
    "name": "Ralph Wien Memorial Airport",
    "city": "Kotzebue",
    "country": "US"
  },
  {
    "code": "OUA",
    "name": "Ouagadougou Thomas Sankara International Airport",
    "city": "Ouagadougou",
    "country": "BF"
  },
  {
    "code": "OUD",
    "name": "Oujda Angads Airport",
    "city": "Ahl Angad",
    "country": "MA"
  },
  {
    "code": "OUE",
    "name": "Ouesso Airport",
    "city": null,
    "country": "CG"
  },
  {
    "code": "OUH",
    "name": "Oudtshoorn Airport",
    "city": "Oudtshoorn",
    "country": "ZA"
  },
  {
    "code": "OUL",
    "name": "Oulu Airport",
    "city": "Oulu / Oulunsalo",
    "country": "FI"
  },
  {
    "code": "OVB",
    "name": "Novosibirsk Tolmachevo Airport",
    "city": "Novosibirsk",
    "country": "RU"
  },
  {
    "code": "OVD",
    "name": "Asturias Airport",
    "city": "Ranón",
    "country": "ES"
  },
  {
    "code": "OVS",
    "name": "Sovetskiy Airport",
    "city": "Sovetskiy",
    "country": "RU"
  },
  {
    "code": "OWB",
    "name": "Owensboro Daviess County Airport",
    "city": "Owensboro",
    "country": "US"
  },
  {
    "code": "OWD",
    "name": "Norwood Memorial Airport",
    "city": "Norwood",
    "country": "US"
  },
  {
    "code": "OXB",
    "name": "Osvaldo Vieira International Airport",
    "city": "Bissau",
    "country": "GW"
  },
  {
    "code": "OXF",
    "name": "London Oxford Airport",
    "city": "Kidlington, Oxfordshire",
    "country": "GB"
  },
  {
    "code": "OXR",
    "name": "Oxnard Airport",
    "city": "Oxnard",
    "country": "US"
  },
  {
    "code": "OYA",
    "name": "Goya Airport",
    "city": "Goya",
    "country": "AR"
  },
  {
    "code": "OYE",
    "name": "Oyem Airport",
    "city": "Oyem",
    "country": "GA"
  },
  {
    "code": "OYK",
    "name": "Oiapoque Airport",
    "city": "Oiapoque",
    "country": "BR"
  },
  {
    "code": "OYO",
    "name": "Tres Arroyos Airport",
    "city": "Tres Arroyos",
    "country": "AR"
  },
  {
    "code": "OYP",
    "name": "Saint-Georges-de-l'Oyapock Airport",
    "city": "Saint-Georges-de-l'Oyapock",
    "country": "GF"
  },
  {
    "code": "OZC",
    "name": "Labo Airport",
    "city": "Ozamiz",
    "country": "PH"
  },
  {
    "code": "OZG",
    "name": "Zagora Airport",
    "city": "Zagora",
    "country": "MA"
  },
  {
    "code": "OZH",
    "name": "Zaporizhzhia International Airport",
    "city": "Zaporizhia",
    "country": "UA"
  },
  {
    "code": "OZP",
    "name": "Moron Air Base",
    "city": "Morón",
    "country": "ES"
  },
  {
    "code": "OZR",
    "name": "Cairns AAF (Fort Rucker) Air Field",
    "city": "Fort Rucker/Ozark",
    "country": "US"
  },
  {
    "code": "OZZ",
    "name": "Ouarzazate International Airport",
    "city": "Ouarzazate",
    "country": "MA"
  },
  {
    "code": "PAB",
    "name": "Bilaspur Airport",
    "city": "Bilaspur",
    "country": "IN"
  },
  {
    "code": "PAC",
    "name": "Marcos A. Gelabert International Airport",
    "city": "Albrook",
    "country": "PA"
  },
  {
    "code": "PAD",
    "name": "Paderborn Lippstadt Airport",
    "city": "Büren",
    "country": "DE"
  },
  {
    "code": "PAE",
    "name": "Seattle Paine Field International Airport",
    "city": "Everett",
    "country": "US"
  },
  {
    "code": "PAG",
    "name": "Pagadian Airport",
    "city": "Pagadian",
    "country": "PH"
  },
  {
    "code": "PAH",
    "name": "Barkley Regional Airport",
    "city": "Paducah",
    "country": "US"
  },
  {
    "code": "PAL",
    "name": "German Olano Air Base",
    "city": "La Dorada",
    "country": "CO"
  },
  {
    "code": "PAM",
    "name": "Tyndall Air Force Base",
    "city": "Panama City",
    "country": "US"
  },
  {
    "code": "PAN",
    "name": "Pattani Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "PAO",
    "name": "Palo Alto Airport",
    "city": "Palo Alto",
    "country": "US"
  },
  {
    "code": "PAP",
    "name": "Toussaint Louverture International Airport",
    "city": "Port-au-Prince",
    "country": "HT"
  },
  {
    "code": "PAQ",
    "name": "Warren \"Bud\" Woods Palmer Municipal Airport",
    "city": "Palmer",
    "country": "US"
  },
  {
    "code": "PAT",
    "name": "Jay Prakash Narayan Airport",
    "city": "Patna",
    "country": "IN"
  },
  {
    "code": "PAV",
    "name": "Paulo Afonso Airport",
    "city": "Paulo Afonso",
    "country": "BR"
  },
  {
    "code": "PAX",
    "name": "Port-de-Paix Airport",
    "city": "Port-de-Paix",
    "country": "HT"
  },
  {
    "code": "PAZ",
    "name": "El Tajín National Airport",
    "city": "Poza Rica",
    "country": "MX"
  },
  {
    "code": "PBC",
    "name": "Hermanos Serdán International Airport",
    "city": "Puebla",
    "country": "MX"
  },
  {
    "code": "PBD",
    "name": "Porbandar Airport",
    "city": "Porbandar",
    "country": "IN"
  },
  {
    "code": "PBF",
    "name": "Pine Bluff Regional Airport, Grider Field",
    "city": "Pine Bluff",
    "country": "US"
  },
  {
    "code": "PBG",
    "name": "Plattsburgh International Airport",
    "city": "Plattsburgh",
    "country": "US"
  },
  {
    "code": "PBH",
    "name": "Paro International Airport",
    "city": "Paro",
    "country": "BT"
  },
  {
    "code": "PBI",
    "name": "Palm Beach International Airport",
    "city": "West Palm Beach",
    "country": "US"
  },
  {
    "code": "PBL",
    "name": "General Bartolome Salom International Airport",
    "city": "Puerto Cabello",
    "country": "VE"
  },
  {
    "code": "PBM",
    "name": "Johan Adolf Pengel International Airport",
    "city": "Zandery",
    "country": "SR"
  },
  {
    "code": "PBN",
    "name": "Porto Amboim Airport",
    "city": "Port Amboim",
    "country": "AO"
  },
  {
    "code": "PBO",
    "name": "Paraburdoo Airport",
    "city": "Paraburdoo",
    "country": "AU"
  },
  {
    "code": "PBR",
    "name": "Puerto Barrios Airport",
    "city": "Puerto Barrios",
    "country": "GT"
  },
  {
    "code": "PBU",
    "name": "Putao Airport",
    "city": "Putao",
    "country": "MM"
  },
  {
    "code": "PBZ",
    "name": "Plettenberg Bay Airport",
    "city": "Plettenberg Bay",
    "country": "ZA"
  },
  {
    "code": "PCF",
    "name": "Potchefstroom Airport",
    "city": "Potchefstroom",
    "country": "ZA"
  },
  {
    "code": "PCL",
    "name": "Cap FAP David Abenzur Rengifo International Airport",
    "city": "Pucallpa",
    "country": "PE"
  },
  {
    "code": "PCP",
    "name": "Principe Airport",
    "city": "São Tomé & Príncipe",
    "country": "ST"
  },
  {
    "code": "PCR",
    "name": "German Olano Airport",
    "city": "Puerto Carreño",
    "country": "CO"
  },
  {
    "code": "PDA",
    "name": "Obando Cesar Gaviria Trujillo Airport",
    "city": "Puerto Inírida",
    "country": "CO"
  },
  {
    "code": "PDG",
    "name": "Minangkabau International Airport",
    "city": "Padang (Katapiang)",
    "country": "ID"
  },
  {
    "code": "PDK",
    "name": "DeKalb Peachtree Airport",
    "city": "Atlanta",
    "country": "US"
  },
  {
    "code": "PDL",
    "name": "João Paulo II Airport",
    "city": "Ponta Delgada",
    "country": "PT"
  },
  {
    "code": "PDO",
    "name": "Pendopo Airport",
    "city": "Talang Gudang-Sumatra Island",
    "country": "ID"
  },
  {
    "code": "PDP",
    "name": "Capitan Corbeta CA Curbelo International Airport",
    "city": "Punta del Este",
    "country": "UY"
  },
  {
    "code": "PDS",
    "name": "Piedras Negras International Airport",
    "city": "Piedras Negras",
    "country": "MX"
  },
  {
    "code": "PDT",
    "name": "Eastern Oregon Regional Airport at Pendleton",
    "city": "Pendleton",
    "country": "US"
  },
  {
    "code": "PDU",
    "name": "Tydeo Larre Borges Airport",
    "city": "Paysandú",
    "country": "UY"
  },
  {
    "code": "PDV",
    "name": "Plovdiv International Airport",
    "city": "Plovdiv",
    "country": "BG"
  },
  {
    "code": "PDX",
    "name": "Portland International Airport",
    "city": "Portland",
    "country": "US"
  },
  {
    "code": "PED",
    "name": "Pardubice Airport",
    "city": "Pardubice",
    "country": "CZ"
  },
  {
    "code": "PEE",
    "name": "Perm International Airport",
    "city": "Perm",
    "country": "RU"
  },
  {
    "code": "PEG",
    "name": "Perugia San Francesco d'Assisi – Umbria International Airport",
    "city": "Perugia (PG)",
    "country": "IT"
  },
  {
    "code": "PEH",
    "name": "Comodoro Pedro Zanni Airport",
    "city": "Pehuajó",
    "country": "AR"
  },
  {
    "code": "PEI",
    "name": "Matecaña International Airport",
    "city": "Pereira",
    "country": "CO"
  },
  {
    "code": "PEK",
    "name": "Beijing Capital International Airport",
    "city": "Beijing",
    "country": "CN"
  },
  {
    "code": "PEM",
    "name": "Padre Aldamiz International Airport",
    "city": "Puerto Maldonado",
    "country": "PE"
  },
  {
    "code": "PEN",
    "name": "Penang International Airport",
    "city": "Penang",
    "country": "MY"
  },
  {
    "code": "PER",
    "name": "Perth International Airport",
    "city": "Perth",
    "country": "AU"
  },
  {
    "code": "PES",
    "name": "Petrozavodsk Airport",
    "city": "Petrozavodsk",
    "country": "RU"
  },
  {
    "code": "PET",
    "name": "João Simões Lopes Neto International Airport",
    "city": "Pelotas",
    "country": "BR"
  },
  {
    "code": "PEV",
    "name": "Pécs-Pogány Airport",
    "city": "Pécs",
    "country": "HU"
  },
  {
    "code": "PEW",
    "name": "Bacha Khan International Airport",
    "city": "Peshawar",
    "country": "PK"
  },
  {
    "code": "PEX",
    "name": "Pechora Airport",
    "city": "Pechora",
    "country": "RU"
  },
  {
    "code": "PEZ",
    "name": "Penza Airport",
    "city": "Penza",
    "country": "RU"
  },
  {
    "code": "PFB",
    "name": "Lauro Kurtz Airport",
    "city": "Passo Fundo",
    "country": "BR"
  },
  {
    "code": "PFO",
    "name": "Paphos International Airport",
    "city": "Paphos",
    "country": "CY"
  },
  {
    "code": "PGA",
    "name": "Page Municipal Airport",
    "city": "Page",
    "country": "US"
  },
  {
    "code": "PGD",
    "name": "Punta Gorda Airport",
    "city": "Punta Gorda",
    "country": "US"
  },
  {
    "code": "PGF",
    "name": "Perpignan-Rivesaltes (Llabanère) Airport",
    "city": "Perpignan/Rivesaltes",
    "country": "FR"
  },
  {
    "code": "PGH",
    "name": "Pantnagar Airport",
    "city": "Pantnagar",
    "country": "IN"
  },
  {
    "code": "PGK",
    "name": "Depati Amir Airport",
    "city": "Pangkal Pinang",
    "country": "ID"
  },
  {
    "code": "PGU",
    "name": "Persian Gulf International Airport",
    "city": "Khiyaroo",
    "country": "IR"
  },
  {
    "code": "PGV",
    "name": "Pitt-Greenville Airport",
    "city": "Greenville",
    "country": "US"
  },
  {
    "code": "PGX",
    "name": "Périgueux-Bassillac Airport",
    "city": "Périgueux/Bassillac",
    "country": "FR"
  },
  {
    "code": "PGZ",
    "name": "Ponta Grossa Airport - Comandante Antonio Amilton Beraldo",
    "city": "Ponta Grossa",
    "country": "BR"
  },
  {
    "code": "PHB",
    "name": "Parnaíba - Prefeito Doutor João Silva Filho International Airport",
    "city": "Parnaíba",
    "country": "BR"
  },
  {
    "code": "PHC",
    "name": "Port Harcourt International Airport",
    "city": "Port Harcourt",
    "country": "NG"
  },
  {
    "code": "PHE",
    "name": "Port Hedland International Airport",
    "city": "Port Hedland",
    "country": "AU"
  },
  {
    "code": "PHF",
    "name": "Newport News Williamsburg International Airport",
    "city": "Newport News",
    "country": "US"
  },
  {
    "code": "PHG",
    "name": "Port Harcourt City Airport / Port Harcourt Air Force Base",
    "city": "Port Harcourt",
    "country": "NG"
  },
  {
    "code": "PHH",
    "name": "Pokhara International Airport",
    "city": "Pokhara",
    "country": "NP"
  },
  {
    "code": "PHL",
    "name": "Philadelphia International Airport",
    "city": "Philadelphia",
    "country": "US"
  },
  {
    "code": "PHS",
    "name": "Phitsanulok Airport",
    "city": "Phitsanulok",
    "country": "TH"
  },
  {
    "code": "PHW",
    "name": "Hendrik Van Eck Airport",
    "city": "Phalaborwa",
    "country": "ZA"
  },
  {
    "code": "PHX",
    "name": "Phoenix Sky Harbor International Airport",
    "city": "Phoenix",
    "country": "US"
  },
  {
    "code": "PHY",
    "name": "Phetchabun Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "PIA",
    "name": "General Wayne A. Downing Peoria International Airport",
    "city": "Peoria",
    "country": "US"
  },
  {
    "code": "PIB",
    "name": "Hattiesburg Laurel Regional Airport",
    "city": "Moselle",
    "country": "US"
  },
  {
    "code": "PIE",
    "name": "St. Petersburg Clearwater International Airport",
    "city": "Pinellas Park",
    "country": "US"
  },
  {
    "code": "PIF",
    "name": "Pingtung Air Force Base North",
    "city": "Pingtung",
    "country": "TW"
  },
  {
    "code": "PIH",
    "name": "Pocatello Regional Airport",
    "city": "Pocatello",
    "country": "US"
  },
  {
    "code": "PIK",
    "name": "Glasgow Prestwick Airport",
    "city": "Prestwick, South Ayrshire",
    "country": "GB"
  },
  {
    "code": "PIL",
    "name": "Aeródromo Don Carlos Miguel Gimenez",
    "city": "Pilar",
    "country": "PY"
  },
  {
    "code": "PIO",
    "name": "Captain Renán Elías Olivera International Airport",
    "city": "Pisco",
    "country": "PE"
  },
  {
    "code": "PIR",
    "name": "Pierre Regional Airport",
    "city": "Pierre",
    "country": "US"
  },
  {
    "code": "PIS",
    "name": "Poitiers-Biard Airport",
    "city": "Poitiers/Biard",
    "country": "FR"
  },
  {
    "code": "PIT",
    "name": "Pittsburgh International Airport",
    "city": "Pittsburgh",
    "country": "US"
  },
  {
    "code": "PIU",
    "name": "Capitán FAP Guillermo Concha Iberico International Airport",
    "city": "Piura",
    "country": "PE"
  },
  {
    "code": "PIW",
    "name": "Pikwitonei Airport",
    "city": "Pikwitonei",
    "country": "CA"
  },
  {
    "code": "PIX",
    "name": "Pico Airport",
    "city": "Pico Island",
    "country": "PT"
  },
  {
    "code": "PIZ",
    "name": "Point Lay LRRS Airport",
    "city": "Point Lay",
    "country": "US"
  },
  {
    "code": "PJC",
    "name": "Aeropuerto Nacional Dr. Augusto Roberto Fuster",
    "city": "Pedro Juan Caballero",
    "country": "PY"
  },
  {
    "code": "PJG",
    "name": "Panjgur Airport",
    "city": "Panjgur",
    "country": "PK"
  },
  {
    "code": "PJM",
    "name": "Puerto Jimenez Airport",
    "city": "Puerto Jimenez",
    "country": "CR"
  },
  {
    "code": "PKB",
    "name": "Mid Ohio Valley Regional Airport",
    "city": "Parkersburg (Williamstown)",
    "country": "US"
  },
  {
    "code": "PKC",
    "name": "Yelizovo Airport",
    "city": "Petropavlovsk-Kamchatsky",
    "country": "RU"
  },
  {
    "code": "PKE",
    "name": "Parkes Airport",
    "city": "Parkes",
    "country": "AU"
  },
  {
    "code": "PKR",
    "name": "Pokhara Domestic Airport",
    "city": "Pokhara",
    "country": "NP"
  },
  {
    "code": "PKT",
    "name": "Port Keats Airport",
    "city": "Wadeye",
    "country": "AU"
  },
  {
    "code": "PKU",
    "name": "Sultan Syarif Kasim II International Airport / Roesmin Nurjadin AFB",
    "city": "Pekanbaru",
    "country": "ID"
  },
  {
    "code": "PKV",
    "name": "Princess Olga Pskov International Airport",
    "city": "Pskov",
    "country": "RU"
  },
  {
    "code": "PKW",
    "name": "Selebi Phikwe Airport",
    "city": "Selebi Phikwe",
    "country": "BW"
  },
  {
    "code": "PKX",
    "name": "Beijing Daxing International Airport",
    "city": "Beijing",
    "country": "CN"
  },
  {
    "code": "PKY",
    "name": "Tjilik Riwut Airport",
    "city": "Palangkaraya",
    "country": "ID"
  },
  {
    "code": "PKZ",
    "name": "Pakse International Airport",
    "city": "Pakse",
    "country": "LA"
  },
  {
    "code": "PLJ",
    "name": "Placencia Airport",
    "city": "Placencia",
    "country": "BZ"
  },
  {
    "code": "PLL",
    "name": "Ponta Pelada Airport / Manaus Air Base",
    "city": "Manaus",
    "country": "BR"
  },
  {
    "code": "PLM",
    "name": "Sultan Mahmud Badaruddin II Airport",
    "city": "Palembang",
    "country": "ID"
  },
  {
    "code": "PLN",
    "name": "Pellston Regional Airport of Emmet County Airport",
    "city": "Pellston",
    "country": "US"
  },
  {
    "code": "PLO",
    "name": "Port Lincoln Airport",
    "city": "Port Lincoln",
    "country": "AU"
  },
  {
    "code": "PLQ",
    "name": "Palanga International Airport",
    "city": "Palanga",
    "country": "LT"
  },
  {
    "code": "PLS",
    "name": "Providenciales International Airport",
    "city": "Providenciales",
    "country": "TC"
  },
  {
    "code": "PLU",
    "name": "Pampulha - Carlos Drummond de Andrade Airport",
    "city": "Belo Horizonte",
    "country": "BR"
  },
  {
    "code": "PLW",
    "name": "Mutiara - SIS Al-Jufrie Airport",
    "city": "Palu",
    "country": "ID"
  },
  {
    "code": "PLX",
    "name": "Semei International Airport",
    "city": "Semey",
    "country": "KZ"
  },
  {
    "code": "PLZ",
    "name": "Chief Dawid Stuurman International Airport",
    "city": "Gqeberha (Port Elizabeth)",
    "country": "ZA"
  },
  {
    "code": "PMA",
    "name": "Pemba Airport",
    "city": "Chake Chake",
    "country": "TZ"
  },
  {
    "code": "PMC",
    "name": "El Tepual International Airport",
    "city": "Puerto Montt",
    "country": "CL"
  },
  {
    "code": "PMD",
    "name": "Palmdale Regional Airport / USAF Plant 42 Airport",
    "city": "Palmdale",
    "country": "US"
  },
  {
    "code": "PMF",
    "name": "Parma Airport",
    "city": "Parma (PR)",
    "country": "IT"
  },
  {
    "code": "PMG",
    "name": "Ponta Porã Airport",
    "city": "Ponta Porã",
    "country": "BR"
  },
  {
    "code": "PMI",
    "name": "Palma de Mallorca Airport",
    "city": "Palma de Mallorca",
    "country": "ES"
  },
  {
    "code": "PMO",
    "name": "Falcone–Borsellino Airport",
    "city": "Palermo",
    "country": "IT"
  },
  {
    "code": "PMQ",
    "name": "Perito Moreno Jalil Hamer Airport",
    "city": "Perito Moreno",
    "country": "AR"
  },
  {
    "code": "PMR",
    "name": "Palmerston North Airport",
    "city": "Palmerston North",
    "country": "NZ"
  },
  {
    "code": "PMS",
    "name": "Palmyra Airport",
    "city": "Tadmur",
    "country": "SY"
  },
  {
    "code": "PMV",
    "name": "Del Caribe Santiago Mariño International Airport",
    "city": "Isla Margarita",
    "country": "VE"
  },
  {
    "code": "PMW",
    "name": "Brigadeiro Lysias Rodrigues Airport",
    "city": "Palmas",
    "country": "BR"
  },
  {
    "code": "PMY",
    "name": "El Tehuelche Airport",
    "city": "Puerto Madryn",
    "country": "AR"
  },
  {
    "code": "PMZ",
    "name": "Palmar Sur Airport",
    "city": "Palmar Sur",
    "country": "CR"
  },
  {
    "code": "PNA",
    "name": "Pamplona Airport",
    "city": "Pamplona",
    "country": "ES"
  },
  {
    "code": "PNB",
    "name": "Porto Nacional Airport",
    "city": "Porto Nacional",
    "country": "BR"
  },
  {
    "code": "PNC",
    "name": "Ponca City Regional Airport",
    "city": "Ponca City",
    "country": "US"
  },
  {
    "code": "PNE",
    "name": "Northeast Philadelphia Airport",
    "city": "Philadelphia",
    "country": "US"
  },
  {
    "code": "PNH",
    "name": "Phnom Penh International Airport",
    "city": "Phnom Penh (Pou Senchey)",
    "country": "KH"
  },
  {
    "code": "PNI",
    "name": "Pohnpei International Airport",
    "city": "Pohnpei Island",
    "country": "FM"
  },
  {
    "code": "PNK",
    "name": "Supadio International Airport",
    "city": "Pontianak",
    "country": "ID"
  },
  {
    "code": "PNL",
    "name": "Pantelleria Airport",
    "city": "Pantelleria (TP)",
    "country": "IT"
  },
  {
    "code": "PNP",
    "name": "Girua Airport",
    "city": "Popondetta",
    "country": "PG"
  },
  {
    "code": "PNQ",
    "name": "Pune International Airport",
    "city": "Pune",
    "country": "IN"
  },
  {
    "code": "PNR",
    "name": "Antonio Agostinho-Neto International Airport",
    "city": "Pointe Noire",
    "country": "CG"
  },
  {
    "code": "PNS",
    "name": "Pensacola International Airport",
    "city": "Pensacola",
    "country": "US"
  },
  {
    "code": "PNT",
    "name": "Lieutenant Julio Gallardo Airport",
    "city": "Puerto Natales",
    "country": "CL"
  },
  {
    "code": "PNV",
    "name": "Panevėžys Air Base",
    "city": "Panevėžys",
    "country": "LT"
  },
  {
    "code": "PNX",
    "name": "North Texas Regional Airport Perrin Field",
    "city": "Denison",
    "country": "US"
  },
  {
    "code": "PNY",
    "name": "Pondicherry Airport",
    "city": "Puducherry (Pondicherry)",
    "country": "IN"
  },
  {
    "code": "PNZ",
    "name": "Senador Nilo Coelho Airport",
    "city": "Petrolina",
    "country": "BR"
  },
  {
    "code": "POA",
    "name": "Porto Alegre-Salgado Filho International Airport",
    "city": "Porto Alegre",
    "country": "BR"
  },
  {
    "code": "POB",
    "name": "Pope Field",
    "city": "Fort Bragg",
    "country": "US"
  },
  {
    "code": "POE",
    "name": "Polk Army Air Field",
    "city": "Fort Polk",
    "country": "US"
  },
  {
    "code": "POG",
    "name": "Port Gentil International Airport",
    "city": "Port Gentil",
    "country": "GA"
  },
  {
    "code": "POI",
    "name": "Capitan Nicolas Rojas Airport",
    "city": "Potosí",
    "country": "BO"
  },
  {
    "code": "POL",
    "name": "Pemba Airport",
    "city": "Pemba",
    "country": "MZ"
  },
  {
    "code": "POM",
    "name": "Port Moresby Jacksons International Airport",
    "city": "Port Moresby",
    "country": "PG"
  },
  {
    "code": "POO",
    "name": "Poços de Caldas - Embaixador Walther Moreira Salles Airport",
    "city": "Poços De Caldas",
    "country": "BR"
  },
  {
    "code": "POP",
    "name": "Gregorio Luperon International Airport",
    "city": "Puerto Plata",
    "country": "DO"
  },
  {
    "code": "POR",
    "name": "Pori Airport",
    "city": "Pori",
    "country": "FI"
  },
  {
    "code": "POS",
    "name": "Piarco International Airport",
    "city": "Port of Spain",
    "country": "TT"
  },
  {
    "code": "POT",
    "name": "Ken Jones Airport",
    "city": "Ken Jones",
    "country": "JM"
  },
  {
    "code": "POU",
    "name": "Dutchess County Airport",
    "city": "Poughkeepsie",
    "country": "US"
  },
  {
    "code": "POW",
    "name": "Portorož Airport",
    "city": "Sečovlje",
    "country": "SI"
  },
  {
    "code": "POX",
    "name": "Pontoise-Cormeilles Aerodrome",
    "city": "Cormeilles-en-Vexin, Val-d'Oise",
    "country": "FR"
  },
  {
    "code": "POZ",
    "name": "Poznań-Ławica Airport",
    "city": "Poznań",
    "country": "PL"
  },
  {
    "code": "PPB",
    "name": "Presidente Prudente Airport",
    "city": "Presidente Prudente",
    "country": "BR"
  },
  {
    "code": "PPG",
    "name": "Pago Pago International Airport",
    "city": "Pago Pago",
    "country": "AS"
  },
  {
    "code": "PPI",
    "name": "Port Pirie Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "PPK",
    "name": "Petropavl International Airport",
    "city": "Petropavl",
    "country": "KZ"
  },
  {
    "code": "PPN",
    "name": "Guillermo León Valencia Airport",
    "city": "Popayán",
    "country": "CO"
  },
  {
    "code": "PPP",
    "name": "Proserpine Whitsunday Coast Airport",
    "city": "Proserpine",
    "country": "AU"
  },
  {
    "code": "PPQ",
    "name": "Paraparaumu Airport",
    "city": null,
    "country": "NZ"
  },
  {
    "code": "PPS",
    "name": "Puerto Princesa International Airport / PAF Antonio Bautista Air Base",
    "city": "Puerto Princesa",
    "country": "PH"
  },
  {
    "code": "PPT",
    "name": "Fa'a'ā International Airport",
    "city": "Papeete",
    "country": "PF"
  },
  {
    "code": "PQC",
    "name": "Phú Quốc International Airport",
    "city": "Phu Quoc Island",
    "country": "VN"
  },
  {
    "code": "PQI",
    "name": "Presque Isle International Airport",
    "city": "Presque Isle",
    "country": "US"
  },
  {
    "code": "PQQ",
    "name": "Port Macquarie Airport",
    "city": "Port Macquarie",
    "country": "AU"
  },
  {
    "code": "PRA",
    "name": "General Urquiza Airport",
    "city": "Parana",
    "country": "AR"
  },
  {
    "code": "PRB",
    "name": "Paso Robles Municipal Airport",
    "city": "Paso Robles",
    "country": "US"
  },
  {
    "code": "PRC",
    "name": "Prescott Regional Airport - Ernest A. Love Field",
    "city": "Prescott",
    "country": "US"
  },
  {
    "code": "PRG",
    "name": "Václav Havel Airport Prague",
    "city": "Prague",
    "country": "CZ"
  },
  {
    "code": "PRH",
    "name": "Phrae Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "PRI",
    "name": "Praslin Island Airport",
    "city": "Praslin Island",
    "country": "SC"
  },
  {
    "code": "PRM",
    "name": "Portimão Airport",
    "city": "Portimão",
    "country": "PT"
  },
  {
    "code": "PRN",
    "name": "Priština Adem Jashari International Airport",
    "city": "Prishtina",
    "country": "XK"
  },
  {
    "code": "PRV",
    "name": "Přerov Air Base",
    "city": "Přerov",
    "country": "CZ"
  },
  {
    "code": "PRX",
    "name": "Cox Field",
    "city": "Paris",
    "country": "US"
  },
  {
    "code": "PRY",
    "name": "Wonderboom Airport",
    "city": "Pretoria",
    "country": "ZA"
  },
  {
    "code": "PSA",
    "name": "Pisa International Airport",
    "city": "Pisa (PI)",
    "country": "IT"
  },
  {
    "code": "PSC",
    "name": "Tri Cities Airport",
    "city": "Pasco",
    "country": "US"
  },
  {
    "code": "PSD",
    "name": "Port Said International Airport",
    "city": "Port Said",
    "country": "EG"
  },
  {
    "code": "PSE",
    "name": "Mercedita International Airport",
    "city": "Ponce",
    "country": "PR"
  },
  {
    "code": "PSG",
    "name": "Petersburg James A Johnson Airport",
    "city": "Petersburg",
    "country": "US"
  },
  {
    "code": "PSI",
    "name": "Pasni Airport",
    "city": "Pasni",
    "country": "PK"
  },
  {
    "code": "PSJ",
    "name": "Kasiguncu Airport",
    "city": "Poso-Celebes Island",
    "country": "ID"
  },
  {
    "code": "PSM",
    "name": "Portsmouth International Airport at Pease",
    "city": "Portsmouth",
    "country": "US"
  },
  {
    "code": "PSO",
    "name": "Antonio Nariño Airport",
    "city": "Chachagüí",
    "country": "CO"
  },
  {
    "code": "PSP",
    "name": "Palm Springs International Airport",
    "city": "Palm Springs",
    "country": "US"
  },
  {
    "code": "PSR",
    "name": "Abruzzo Airport",
    "city": "Pescara",
    "country": "IT"
  },
  {
    "code": "PSS",
    "name": "Libertador Gral D Jose De San Martin Airport",
    "city": "Posadas",
    "country": "AR"
  },
  {
    "code": "PSU",
    "name": "Pangsuma Airport",
    "city": "Putussibau-Borneo Island",
    "country": "ID"
  },
  {
    "code": "PSZ",
    "name": "Capitán Av. Salvador Ogaya G. airport",
    "city": "Puerto Suárez",
    "country": "BO"
  },
  {
    "code": "PTG",
    "name": "Polokwane International Airport",
    "city": "Polokwane",
    "country": "ZA"
  },
  {
    "code": "PTH",
    "name": "Port Heiden Airport",
    "city": "Port Heiden",
    "country": "US"
  },
  {
    "code": "PTJ",
    "name": "Portland Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "PTK",
    "name": "Oakland County International Airport",
    "city": "Pontiac",
    "country": "US"
  },
  {
    "code": "PTM",
    "name": "Palmarito Airport",
    "city": "Palmarito",
    "country": "VE"
  },
  {
    "code": "PTP",
    "name": "Maryse Condé International Airport",
    "city": "Pointe-à-Pitre",
    "country": "GP"
  },
  {
    "code": "PTU",
    "name": "Platinum Airport",
    "city": "Platinum",
    "country": "US"
  },
  {
    "code": "PTX",
    "name": "Pitalito Airport",
    "city": "Pitalito",
    "country": "CO"
  },
  {
    "code": "PTY",
    "name": "Tocumen International Airport",
    "city": "Tocumen",
    "country": "PA"
  },
  {
    "code": "PUB",
    "name": "Pueblo Memorial Airport",
    "city": "Pueblo",
    "country": "US"
  },
  {
    "code": "PUD",
    "name": "Puerto Deseado Airport",
    "city": "Puerto Deseado",
    "country": "AR"
  },
  {
    "code": "PUF",
    "name": "Pau Pyrénées Airport",
    "city": "Pau/Pyrénées (Uzein)",
    "country": "FR"
  },
  {
    "code": "PUG",
    "name": "Port Augusta Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "PUJ",
    "name": "Punta Cana International Airport",
    "city": "Punta Cana",
    "country": "DO"
  },
  {
    "code": "PUQ",
    "name": "President Carlos Ibáñez International Airport",
    "city": "Punta Arenas",
    "country": "CL"
  },
  {
    "code": "PUS",
    "name": "Gimhae International Airport",
    "city": "Busan",
    "country": "KR"
  },
  {
    "code": "PUT",
    "name": "Sri Sathya Sai Airport",
    "city": "Puttaparthi",
    "country": "IN"
  },
  {
    "code": "PUU",
    "name": "Tres De Mayo Airport",
    "city": "Puerto Asís",
    "country": "CO"
  },
  {
    "code": "PUW",
    "name": "Pullman-Moscow Regional Airport",
    "city": "Pullman",
    "country": "US"
  },
  {
    "code": "PUY",
    "name": "Pula Airport",
    "city": "Pula",
    "country": "HR"
  },
  {
    "code": "PUZ",
    "name": "Puerto Cabezas Airport",
    "city": "Puerto Cabezas",
    "country": "NI"
  },
  {
    "code": "PVA",
    "name": "El Embrujo Airport",
    "city": "Providencia",
    "country": "CO"
  },
  {
    "code": "PVD",
    "name": "Rhode Island T. F. Green International Airport",
    "city": "Providence/Warwick",
    "country": "US"
  },
  {
    "code": "PVG",
    "name": "Shanghai Pudong International Airport",
    "city": "Shanghai (Pudong)",
    "country": "CN"
  },
  {
    "code": "PVH",
    "name": "Governador Jorge Teixeira de Oliveira Airport",
    "city": "Porto Velho",
    "country": "BR"
  },
  {
    "code": "PVK",
    "name": "Aktion National Airport",
    "city": "Preveza",
    "country": "GR"
  },
  {
    "code": "PVO",
    "name": "Reales Tamarindos Airport",
    "city": "Portoviejo",
    "country": "EC"
  },
  {
    "code": "PVR",
    "name": "Puerto Vallarta International Airport",
    "city": "Puerto Vallarta",
    "country": "MX"
  },
  {
    "code": "PVS",
    "name": "Provideniya Bay Airport",
    "city": "Chukotka",
    "country": "RU"
  },
  {
    "code": "PVU",
    "name": "Provo Municipal Airport",
    "city": "Provo",
    "country": "US"
  },
  {
    "code": "PWE",
    "name": "Pevek Airport",
    "city": "Apapelgino",
    "country": "RU"
  },
  {
    "code": "PWK",
    "name": "Chicago Executive Airport",
    "city": "Chicago/Prospect Heights/Wheeling",
    "country": "US"
  },
  {
    "code": "PWM",
    "name": "Portland International Jetport",
    "city": "Portland",
    "country": "US"
  },
  {
    "code": "PWQ",
    "name": "Pavlodar International Airport",
    "city": "Pavlodar",
    "country": "KZ"
  },
  {
    "code": "PWT",
    "name": "Bremerton National Airport",
    "city": "Bremerton",
    "country": "US"
  },
  {
    "code": "PWY",
    "name": "Ralph Wenz Field",
    "city": "Pinedale",
    "country": "US"
  },
  {
    "code": "PXM",
    "name": "Puerto Escondido International Airport",
    "city": "Puerto Escondido",
    "country": "MX"
  },
  {
    "code": "PXO",
    "name": "Porto Santo Airport",
    "city": "Vila Baleira",
    "country": "PT"
  },
  {
    "code": "PXR",
    "name": "Surin Airport",
    "city": "Surin",
    "country": "TH"
  },
  {
    "code": "PXU",
    "name": "Pleiku Airport",
    "city": "Pleiku",
    "country": "VN"
  },
  {
    "code": "PYH",
    "name": "Cacique Aramare Airport",
    "city": "Puerto Ayacucho",
    "country": "VE"
  },
  {
    "code": "PYJ",
    "name": "Polyarny Airport",
    "city": "Yakutia",
    "country": "RU"
  },
  {
    "code": "PYK",
    "name": "Payam Karaj International Airport",
    "city": "Karaj",
    "country": "IR"
  },
  {
    "code": "PYR",
    "name": "Andravida Air Base",
    "city": "Andravida",
    "country": "GR"
  },
  {
    "code": "PZA",
    "name": "Paz De Ariporo Airport",
    "city": "Paz De Ariporo",
    "country": "CO"
  },
  {
    "code": "PZB",
    "name": "Pietermaritzburg Airport",
    "city": "Pietermaritzburg",
    "country": "ZA"
  },
  {
    "code": "PZH",
    "name": "Zhob Airport",
    "city": "Fort Sandeman",
    "country": "PK"
  },
  {
    "code": "PZI",
    "name": "Panzhihua Bao'anying Airport",
    "city": "Panzhihua (Renhe)",
    "country": "CN"
  },
  {
    "code": "PZO",
    "name": "General Manuel Carlos Piar International Airport",
    "city": "Puerto Ordaz-Ciudad Guayana",
    "country": "VE"
  },
  {
    "code": "PZS",
    "name": "Maquehue Airport",
    "city": "Temuco",
    "country": "CL"
  },
  {
    "code": "PZU",
    "name": "Port Sudan New International Airport",
    "city": "Port Sudan",
    "country": "SD"
  },
  {
    "code": "PZY",
    "name": "Piešťany Airport",
    "city": "Piešťany",
    "country": "SK"
  },
  {
    "code": "QBC",
    "name": "Bella Coola Airport",
    "city": "Bella Coola",
    "country": "CA"
  },
  {
    "code": "QCY",
    "name": "RAF Coningsby",
    "city": "Lincoln, Lincolnshire",
    "country": "GB"
  },
  {
    "code": "QGU",
    "name": "Gifu Airport",
    "city": "Gifu",
    "country": "JP"
  },
  {
    "code": "QHR",
    "name": "Harar Meda Airport",
    "city": "Debre Zeyit",
    "country": "ET"
  },
  {
    "code": "QMJ",
    "name": "Shahid Asiyaee Airport",
    "city": "Masjed Soleyman",
    "country": "IR"
  },
  {
    "code": "QNS",
    "name": "Canoas Air Force Base",
    "city": "Porto Alegre",
    "country": "BR"
  },
  {
    "code": "QOW",
    "name": "Sam Mbakwe International Airport",
    "city": "Owerri",
    "country": "NG"
  },
  {
    "code": "QPG",
    "name": "Paya Lebar Air Base",
    "city": "Paya Lebar",
    "country": "SG"
  },
  {
    "code": "QPS",
    "name": "Campo Fontenelle",
    "city": "Pirassununga",
    "country": "BR"
  },
  {
    "code": "QRA",
    "name": "Rand Airport",
    "city": "Johannesburg",
    "country": "ZA"
  },
  {
    "code": "QRM",
    "name": "Narromine Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "QRO",
    "name": "Querétaro Intercontinental Airport",
    "city": "Querétaro",
    "country": "MX"
  },
  {
    "code": "QRW",
    "name": "Warri Airport",
    "city": "Okpe",
    "country": "NG"
  },
  {
    "code": "QSF",
    "name": "Ain Arnat Airport",
    "city": "Sétif",
    "country": "DZ"
  },
  {
    "code": "QSR",
    "name": "Salerno Costa d'Amalfi Airport",
    "city": "Salerno",
    "country": "IT"
  },
  {
    "code": "QSZ",
    "name": "Shache Airport",
    "city": "Shache",
    "country": "CN"
  },
  {
    "code": "QUO",
    "name": "Akwa Ibom International Airport",
    "city": "Uyo",
    "country": "NG"
  },
  {
    "code": "RAB",
    "name": "Tokua Airport",
    "city": "Kokopo",
    "country": "PG"
  },
  {
    "code": "RAE",
    "name": "Arar Domestic Airport",
    "city": "Arar",
    "country": "SA"
  },
  {
    "code": "RAH",
    "name": "Rafha Domestic Airport",
    "city": "Rafha",
    "country": "SA"
  },
  {
    "code": "RAI",
    "name": "Nelson Mandela International Airport",
    "city": "Praia",
    "country": "CV"
  },
  {
    "code": "RAJ",
    "name": "Rajkot Airport",
    "city": "Rajkot",
    "country": "IN"
  },
  {
    "code": "RAK",
    "name": "Marrakesh Menara Airport",
    "city": "Marrakesh",
    "country": "MA"
  },
  {
    "code": "RAL",
    "name": "Riverside Municipal Airport",
    "city": "Riverside",
    "country": "US"
  },
  {
    "code": "RAO",
    "name": "Leite Lopes Airport",
    "city": "Ribeirão Preto",
    "country": "BR"
  },
  {
    "code": "RAP",
    "name": "Rapid City Regional Airport",
    "city": "Rapid City",
    "country": "US"
  },
  {
    "code": "RAR",
    "name": "Rarotonga International Airport",
    "city": "Avarua",
    "country": "CK"
  },
  {
    "code": "RAS",
    "name": "Sardar-e-Jangal Airport",
    "city": "Rasht",
    "country": "IR"
  },
  {
    "code": "RAZ",
    "name": "Rawalakot Airport",
    "city": "Rawalakot",
    "country": "PK"
  },
  {
    "code": "RBA",
    "name": "Rabat-Salé Airport",
    "city": "Rabat",
    "country": "MA"
  },
  {
    "code": "RBE",
    "name": "Ratanakiri Airport",
    "city": "Ratanakiri",
    "country": "KH"
  },
  {
    "code": "RBL",
    "name": "Red Bluff Municipal Airport",
    "city": "Red Bluff",
    "country": "US"
  },
  {
    "code": "RBR",
    "name": "Rio Branco-Plácido de Castro International Airport",
    "city": "Rio Branco",
    "country": "BR"
  },
  {
    "code": "RBY",
    "name": "Ruby Airport",
    "city": "Ruby",
    "country": "US"
  },
  {
    "code": "RCA",
    "name": "Ellsworth Air Force Base",
    "city": "Rapid City",
    "country": "US"
  },
  {
    "code": "RCB",
    "name": "Richards Bay Airport",
    "city": "Richards Bay",
    "country": "ZA"
  },
  {
    "code": "RCH",
    "name": "Almirante Padilla Airport",
    "city": "Riohacha",
    "country": "CO"
  },
  {
    "code": "RCO",
    "name": "Rochefort-Saint-Agnant (BA 721) Airport",
    "city": "Rochefort/Saint-Agnant",
    "country": "FR"
  },
  {
    "code": "RCQ",
    "name": "Reconquista Airport",
    "city": "Reconquista",
    "country": "AR"
  },
  {
    "code": "RCU",
    "name": "Area De Material Airport",
    "city": "Rio Cuarto",
    "country": "AR"
  },
  {
    "code": "RDD",
    "name": "Redding Municipal Airport",
    "city": "Redding",
    "country": "US"
  },
  {
    "code": "RDG",
    "name": "Reading Regional Airport (Carl A Spaatz Field)",
    "city": "Reading",
    "country": "US"
  },
  {
    "code": "RDL",
    "name": "Bardawil International Airport",
    "city": "El Hassana",
    "country": "EG"
  },
  {
    "code": "RDM",
    "name": "Roberts Field",
    "city": "Redmond",
    "country": "US"
  },
  {
    "code": "RDO",
    "name": "Warsaw Radom Airport",
    "city": "Radom",
    "country": "PL"
  },
  {
    "code": "RDP",
    "name": "Kazi Nazrul Islam Airport",
    "city": "Durgapur",
    "country": "IN"
  },
  {
    "code": "RDR",
    "name": "Grand Forks Air Force Base",
    "city": "Grand Forks",
    "country": "US"
  },
  {
    "code": "RDS",
    "name": "Rincon De Los Sauces Airport",
    "city": "Rincon de los Sauces",
    "country": "AR"
  },
  {
    "code": "RDU",
    "name": "Raleigh-Durham International Airport",
    "city": "Raleigh/Durham",
    "country": "US"
  },
  {
    "code": "RDZ",
    "name": "Rodez–Aveyron Airport",
    "city": "Rodez/Marcillac",
    "country": "FR"
  },
  {
    "code": "REA",
    "name": "Reao Airport",
    "city": "Reao",
    "country": "PF"
  },
  {
    "code": "REC",
    "name": "Recife/Guararapes - Gilberto Freyre International Airport",
    "city": "Recife",
    "country": "BR"
  },
  {
    "code": "REG",
    "name": "Reggio Calabria Airport",
    "city": "Reggio Calabria",
    "country": "IT"
  },
  {
    "code": "REL",
    "name": "Almirante Marco Andres Zar Airport",
    "city": "Rawson",
    "country": "AR"
  },
  {
    "code": "REN",
    "name": "Orenburg Central Airport",
    "city": "Orenburg",
    "country": "RU"
  },
  {
    "code": "RER",
    "name": "Retalhuleu Airport",
    "city": "Retalhuleu",
    "country": "GT"
  },
  {
    "code": "RES",
    "name": "Resistencia International Airport",
    "city": "Resistencia",
    "country": "AR"
  },
  {
    "code": "REU",
    "name": "Reus Airport",
    "city": "Reus",
    "country": "ES"
  },
  {
    "code": "REW",
    "name": "Rewa Airport, Chorhata, REWA",
    "city": "Rewa",
    "country": "IN"
  },
  {
    "code": "REX",
    "name": "General Lucio Blanco International Airport",
    "city": "Reynosa",
    "country": "MX"
  },
  {
    "code": "RFD",
    "name": "Chicago Rockford International Airport",
    "city": "Chicago/Rockford",
    "country": "US"
  },
  {
    "code": "RFP",
    "name": "Raiatea Airport",
    "city": "Uturoa",
    "country": "PF"
  },
  {
    "code": "RGA",
    "name": "Hermes Quijada International Airport",
    "city": "Rio Grande",
    "country": "AR"
  },
  {
    "code": "RGI",
    "name": "Rangiroa Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "RGK",
    "name": "Gorno-Altaysk Airport",
    "city": "Gorno-Altaysk",
    "country": "RU"
  },
  {
    "code": "RGL",
    "name": "Piloto Civil Norberto Fernández International Airport",
    "city": "Rio Gallegos",
    "country": "AR"
  },
  {
    "code": "RGN",
    "name": "Yangon International Airport",
    "city": "Yangon",
    "country": "MM"
  },
  {
    "code": "RGO",
    "name": "Orang (Chongjin) Airport",
    "city": "Hoemun-ri",
    "country": "KP"
  },
  {
    "code": "RGS",
    "name": "Burgos Airport",
    "city": "Burgos",
    "country": "ES"
  },
  {
    "code": "RGT",
    "name": "Japura Airport",
    "city": "Rengat-Sumatra Island",
    "country": "ID"
  },
  {
    "code": "RHD",
    "name": "Termas de Río Hondo international Airport",
    "city": "Termas de Río Hondo",
    "country": "AR"
  },
  {
    "code": "RHI",
    "name": "Rhinelander Oneida County Airport",
    "city": "Rhinelander",
    "country": "US"
  },
  {
    "code": "RHO",
    "name": "Diagoras Airport",
    "city": "Rhodes",
    "country": "GR"
  },
  {
    "code": "RIA",
    "name": "Santa Maria Airport",
    "city": "Santa Maria",
    "country": "BR"
  },
  {
    "code": "RIB",
    "name": "Capitán Av. Selin Zeitun Lopez Airport",
    "city": "Riberalta",
    "country": "BO"
  },
  {
    "code": "RIC",
    "name": "Richmond International Airport",
    "city": "Richmond",
    "country": "US"
  },
  {
    "code": "RIJ",
    "name": "Juan Simons Vela Airport",
    "city": "Rioja",
    "country": "PE"
  },
  {
    "code": "RIL",
    "name": "Garfield County Regional Airport",
    "city": "Rifle",
    "country": "US"
  },
  {
    "code": "RIS",
    "name": "Rishiri Airport",
    "city": "Rishiri",
    "country": "JP"
  },
  {
    "code": "RIV",
    "name": "March Air Reserve Base",
    "city": "Riverside",
    "country": "US"
  },
  {
    "code": "RIW",
    "name": "Central Wyoming Regional Airport",
    "city": "Riverton",
    "country": "US"
  },
  {
    "code": "RIX",
    "name": "Riga International Airport",
    "city": "Riga",
    "country": "LV"
  },
  {
    "code": "RIY",
    "name": "Riyan International Airport",
    "city": "Mukalla(Riyan)",
    "country": "YE"
  },
  {
    "code": "RIZ",
    "name": "Rizhao Shanzihe Airport",
    "city": "Rizhao (Donggang)",
    "country": "CN"
  },
  {
    "code": "RJA",
    "name": "Rajahmundry Airport",
    "city": "Madhurapudi",
    "country": "IN"
  },
  {
    "code": "RJH",
    "name": "Shah Makhdum Airport",
    "city": "Rajshahi",
    "country": "BD"
  },
  {
    "code": "RJK",
    "name": "Rijeka Airport",
    "city": "Rijeka(Omišalj)",
    "country": "HR"
  },
  {
    "code": "RJL",
    "name": "Logroño-Agoncillo Airport",
    "city": "Logroño",
    "country": "ES"
  },
  {
    "code": "RJN",
    "name": "Rafsanjan Airport",
    "city": "Rafsanjan",
    "country": "IR"
  },
  {
    "code": "RKD",
    "name": "Knox County Regional Airport",
    "city": "Rockland",
    "country": "US"
  },
  {
    "code": "RKE",
    "name": "Copenhagen Roskilde Airport",
    "city": "Roskilde",
    "country": "DK"
  },
  {
    "code": "RKS",
    "name": "Southwest Wyoming Regional Airport",
    "city": "Rock Springs",
    "country": "US"
  },
  {
    "code": "RKT",
    "name": "Ras Al Khaimah International Airport",
    "city": "Ras Al Khaimah",
    "country": "AE"
  },
  {
    "code": "RKV",
    "name": "Reykjavík Domestic Airport",
    "city": "Reykjavík",
    "country": "IS"
  },
  {
    "code": "RKZ",
    "name": "Xigaze Peace Airport / Shigatse Air Base",
    "city": "Xigazê (Samzhubzê)",
    "country": "CN"
  },
  {
    "code": "RLG",
    "name": "Rostock-Laage Airport",
    "city": "Laage",
    "country": "DE"
  },
  {
    "code": "RLK",
    "name": "Bayannur Tianjitai Airport",
    "city": "Bavannur",
    "country": "CN"
  },
  {
    "code": "RMA",
    "name": "Roma Airport",
    "city": "Roma",
    "country": "AU"
  },
  {
    "code": "RME",
    "name": "Griffiss International Airport",
    "city": "Rome",
    "country": "US"
  },
  {
    "code": "RMF",
    "name": "Marsa Alam International Airport",
    "city": "Marsa Alam",
    "country": "EG"
  },
  {
    "code": "RMG",
    "name": "Richard B Russell Airport",
    "city": "Rome",
    "country": "US"
  },
  {
    "code": "RMI",
    "name": "Federico Fellini International Airport",
    "city": "Rimini (RN)",
    "country": "IT"
  },
  {
    "code": "RMK",
    "name": "Renmark Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "RML",
    "name": "Colombo Ratmalana Airport",
    "city": "Colombo",
    "country": "LK"
  },
  {
    "code": "RMO",
    "name": "Chişinău International Airport",
    "city": "Chişinău",
    "country": "MD"
  },
  {
    "code": "RMQ",
    "name": "Taichung International Airport / Ching Chuang Kang Air Base",
    "city": "Taichung (Qingshui)",
    "country": "TW"
  },
  {
    "code": "RMS",
    "name": "Ramstein Air Base",
    "city": "Ramstein-Miesenbach",
    "country": "DE"
  },
  {
    "code": "RMU",
    "name": "Region of Murcia International Airport",
    "city": "Corvera",
    "country": "ES"
  },
  {
    "code": "RMZ",
    "name": "Tobolsk Remezov Airport",
    "city": "Tobolsk",
    "country": "RU"
  },
  {
    "code": "RNB",
    "name": "Ronneby Airport",
    "city": "Ronneby",
    "country": "SE"
  },
  {
    "code": "RND",
    "name": "Randolph Air Force Base",
    "city": "Universal City",
    "country": "US"
  },
  {
    "code": "RNE",
    "name": "Roanne-Renaison Airport",
    "city": "Saint-Léger-sur-Roanne",
    "country": "FR"
  },
  {
    "code": "RNH",
    "name": "New Richmond Regional Airport",
    "city": "New Richmond",
    "country": "US"
  },
  {
    "code": "RNJ",
    "name": "Yoron Airport",
    "city": "Yoron",
    "country": "JP"
  },
  {
    "code": "RNN",
    "name": "Bornholm Airport",
    "city": "Rønne",
    "country": "DK"
  },
  {
    "code": "RNO",
    "name": "Reno Tahoe International Airport",
    "city": "Reno",
    "country": "US"
  },
  {
    "code": "RNS",
    "name": "Rennes-Saint-Jacques Airport",
    "city": "Saint-Jacques-de-la-Lande, Ille-et-Vilaine",
    "country": "FR"
  },
  {
    "code": "ROA",
    "name": "Roanoke–Blacksburg Regional Airport",
    "city": "Roanoke",
    "country": "US"
  },
  {
    "code": "ROB",
    "name": "Roberts International Airport",
    "city": "Monrovia",
    "country": "LR"
  },
  {
    "code": "ROC",
    "name": "Frederick Douglass Greater Rochester International Airport",
    "city": "Rochester",
    "country": "US"
  },
  {
    "code": "ROD",
    "name": "Robertson Airport",
    "city": "Robertson",
    "country": "ZA"
  },
  {
    "code": "ROI",
    "name": "Roi Et Airport",
    "city": "Roi Et",
    "country": "TH"
  },
  {
    "code": "ROK",
    "name": "Rockhampton Airport",
    "city": "Rockhampton",
    "country": "AU"
  },
  {
    "code": "ROO",
    "name": "Maestro Marinho Franco Airport",
    "city": "Rondonópolis",
    "country": "BR"
  },
  {
    "code": "ROP",
    "name": "Rota International Airport",
    "city": "Rota Island",
    "country": "MP"
  },
  {
    "code": "ROR",
    "name": "Roman Tmetuchl International Airport",
    "city": "Babelthuap Island",
    "country": "PW"
  },
  {
    "code": "ROS",
    "name": "Rosario Islas Malvinas International Airport",
    "city": "Rosario",
    "country": "AR"
  },
  {
    "code": "ROT",
    "name": "Rotorua Regional Airport",
    "city": "Rotorua",
    "country": "NZ"
  },
  {
    "code": "ROV",
    "name": "Platov International Airport",
    "city": "Rostov-on-Don",
    "country": "RU"
  },
  {
    "code": "ROW",
    "name": "Roswell Air Center Airport",
    "city": "Roswell",
    "country": "US"
  },
  {
    "code": "ROZ",
    "name": "Rota Naval Station Airport",
    "city": "Rota",
    "country": "ES"
  },
  {
    "code": "RPM",
    "name": "Ngukurr Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "RPN",
    "name": "Rosh Pina Airport",
    "city": "Rosh Pina",
    "country": "IL"
  },
  {
    "code": "RPR",
    "name": "Swami Vivekananda Airport",
    "city": "Raipur",
    "country": "IN"
  },
  {
    "code": "RQA",
    "name": "Ruoqiang Loulan Airport",
    "city": "Ruoqiang Town",
    "country": "CN"
  },
  {
    "code": "RQW",
    "name": "Qayyarah West Airport",
    "city": "Qayyarah",
    "country": "IQ"
  },
  {
    "code": "RQY",
    "name": "Rashtrakavi Kuvempu Airport",
    "city": "Shimoga",
    "country": "IN"
  },
  {
    "code": "RRG",
    "name": "Sir Charles Gaetan Duval Airport",
    "city": "Port Mathurin",
    "country": "MU"
  },
  {
    "code": "RRK",
    "name": "Rourkela Airport",
    "city": "Rourkela",
    "country": "IN"
  },
  {
    "code": "RRS",
    "name": "Røros Airport",
    "city": "Røros",
    "country": "NO"
  },
  {
    "code": "RSA",
    "name": "Santa Rosa Airport",
    "city": "Santa Rosa",
    "country": "AR"
  },
  {
    "code": "RSD",
    "name": "Rock Sound International Airport",
    "city": "Rock Sound",
    "country": "BS"
  },
  {
    "code": "RSI",
    "name": "Red Sea International Airport",
    "city": "Hanak",
    "country": "SA"
  },
  {
    "code": "RSL",
    "name": "Russell Municipal Airport",
    "city": "Russell",
    "country": "US"
  },
  {
    "code": "RST",
    "name": "Rochester International Airport",
    "city": "Rochester",
    "country": "US"
  },
  {
    "code": "RSU",
    "name": "Yeosu Airport",
    "city": "Yeosu",
    "country": "KR"
  },
  {
    "code": "RSW",
    "name": "Southwest Florida International Airport",
    "city": "Fort Myers",
    "country": "US"
  },
  {
    "code": "RTB",
    "name": "Juan Manuel Gálvez International Airport",
    "city": "Coxen Hole",
    "country": "HN"
  },
  {
    "code": "RTC",
    "name": "Ratnagiri Airport",
    "city": null,
    "country": "IN"
  },
  {
    "code": "RTE",
    "name": "Campo de Marte Airport",
    "city": "São Paulo",
    "country": "BR"
  },
  {
    "code": "RTM",
    "name": "Rotterdam The Hague Airport",
    "city": "Rotterdam",
    "country": "NL"
  },
  {
    "code": "RUA",
    "name": "Arua Airport",
    "city": "Arua",
    "country": "UG"
  },
  {
    "code": "RUG",
    "name": "Rugao Air Base",
    "city": "Rugao (Nantong)",
    "country": "CN"
  },
  {
    "code": "RUH",
    "name": "King Khalid International Airport",
    "city": "Riyadh",
    "country": "SA"
  },
  {
    "code": "RUI",
    "name": "Sierra Blanca Regional Airport",
    "city": "Alto",
    "country": "US"
  },
  {
    "code": "RUN",
    "name": "Roland Garros Airport",
    "city": "Sainte-Marie",
    "country": "RE"
  },
  {
    "code": "RUR",
    "name": "Rurutu Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "RUT",
    "name": "Rutland - Southern Vermont Regional Airport",
    "city": "Rutland",
    "country": "US"
  },
  {
    "code": "RUV",
    "name": "Rubelsanto Airport",
    "city": "Rubelsanto",
    "country": "GT"
  },
  {
    "code": "RVK",
    "name": "Rørvik Airport, Ryum",
    "city": "Rørvik",
    "country": "NO"
  },
  {
    "code": "RVN",
    "name": "Rovaniemi Airport",
    "city": "Rovaniemi",
    "country": "FI"
  },
  {
    "code": "RVS",
    "name": "Tulsa Riverside Airport",
    "city": "Tulsa",
    "country": "US"
  },
  {
    "code": "RWF",
    "name": "Redwood Falls Municipal Airport",
    "city": "Redwood Falls",
    "country": "US"
  },
  {
    "code": "RWI",
    "name": "Rocky Mount Wilson Regional Airport",
    "city": "Rocky Mount",
    "country": "US"
  },
  {
    "code": "RWL",
    "name": "Rawlins Municipal Airport/Harvey Field",
    "city": "Rawlins",
    "country": "US"
  },
  {
    "code": "RWN",
    "name": "Rivne International Airport",
    "city": "Rivne",
    "country": "UA"
  },
  {
    "code": "RXS",
    "name": "Roxas Airport",
    "city": "Roxas City",
    "country": "PH"
  },
  {
    "code": "RYB",
    "name": "Staroselye Airport",
    "city": "Rybinsk",
    "country": "RU"
  },
  {
    "code": "RYK",
    "name": "Shaikh Zaid Airport",
    "city": "Rahim Yar Khan",
    "country": "PK"
  },
  {
    "code": "RYN",
    "name": "Royan-Médis Airport",
    "city": "Royan/Médis",
    "country": "FR"
  },
  {
    "code": "RZA",
    "name": "Santa Cruz Airport",
    "city": "Puerto Santa Cruz",
    "country": "AR"
  },
  {
    "code": "RZE",
    "name": "Rzeszów-Jasionka Airport",
    "city": "Jasionka",
    "country": "PL"
  },
  {
    "code": "RZR",
    "name": "Ramsar Airport",
    "city": "Ramsar",
    "country": "IR"
  },
  {
    "code": "RZV",
    "name": "Rize–Artvin Airport",
    "city": "Rize",
    "country": "TR"
  },
  {
    "code": "SAB",
    "name": "Juancho E. Yrausquin Airport",
    "city": "Zion's Hill",
    "country": "BQ"
  },
  {
    "code": "SAC",
    "name": "Sacramento Executive Airport",
    "city": "Sacramento",
    "country": "US"
  },
  {
    "code": "SAF",
    "name": "Santa Fe Municipal Airport",
    "city": "Santa Fe",
    "country": "US"
  },
  {
    "code": "SAG",
    "name": "Shirdi International Airport",
    "city": "Kakadi",
    "country": "IN"
  },
  {
    "code": "SAH",
    "name": "Sanaa International Airport",
    "city": "Sanaa",
    "country": "YE"
  },
  {
    "code": "SAI",
    "name": "Siem Reap-Angkor International Airport",
    "city": "Siem Reap",
    "country": "KH"
  },
  {
    "code": "SAL",
    "name": "El Salvador International Airport Saint Óscar Arnulfo Romero y Galdámez",
    "city": "San Salvador (San Luis Talpa)",
    "country": "SV"
  },
  {
    "code": "SAN",
    "name": "San Diego International Airport",
    "city": "San Diego",
    "country": "US"
  },
  {
    "code": "SAP",
    "name": "Ramón Villeda Morales International Airport",
    "city": "San Pedro Sula",
    "country": "HN"
  },
  {
    "code": "SAQ",
    "name": "San Andros Airport",
    "city": "Andros Island",
    "country": "BS"
  },
  {
    "code": "SAT",
    "name": "San Antonio International Airport",
    "city": "San Antonio",
    "country": "US"
  },
  {
    "code": "SAV",
    "name": "Savannah Hilton Head International Airport",
    "city": "Savannah",
    "country": "US"
  },
  {
    "code": "SAW",
    "name": "Istanbul Sabiha Gökçen International Airport",
    "city": "Pendik, Istanbul",
    "country": "TR"
  },
  {
    "code": "SBA",
    "name": "Santa Barbara Municipal Airport",
    "city": "Santa Barbara",
    "country": "US"
  },
  {
    "code": "SBD",
    "name": "San Bernardino International Airport",
    "city": "San Bernardino",
    "country": "US"
  },
  {
    "code": "SBH",
    "name": "St. Jean Airport",
    "city": "Gustavia",
    "country": "BL"
  },
  {
    "code": "SBK",
    "name": "Saint-Brieuc-Armor Airport",
    "city": "Trémuson, Côtes-d'Armor",
    "country": "FR"
  },
  {
    "code": "SBL",
    "name": "Santa Ana Del Yacuma Airport",
    "city": "Santa Ana del Yacuma",
    "country": "BO"
  },
  {
    "code": "SBN",
    "name": "South Bend International Airport",
    "city": "South Bend",
    "country": "US"
  },
  {
    "code": "SBP",
    "name": "San Luis County Regional Airport",
    "city": "San Luis Obispo",
    "country": "US"
  },
  {
    "code": "SBT",
    "name": "Sabetta International Airport",
    "city": "Sabetta",
    "country": "RU"
  },
  {
    "code": "SBU",
    "name": "Springbok Airport",
    "city": "Springbok",
    "country": "ZA"
  },
  {
    "code": "SBW",
    "name": "Sibu Airport",
    "city": "Sibu",
    "country": "MY"
  },
  {
    "code": "SBY",
    "name": "Salisbury Ocean City Wicomico Regional Airport",
    "city": "Salisbury",
    "country": "US"
  },
  {
    "code": "SBZ",
    "name": "Sibiu International Airport",
    "city": "Sibiu",
    "country": "RO"
  },
  {
    "code": "SCC",
    "name": "Deadhorse Airport",
    "city": "Deadhorse",
    "country": "US"
  },
  {
    "code": "SCE",
    "name": "State College Regional Airport",
    "city": "State College",
    "country": "US"
  },
  {
    "code": "SCH",
    "name": "Schenectady County Airport",
    "city": "Schenectady",
    "country": "US"
  },
  {
    "code": "SCI",
    "name": "Paramillo Airport",
    "city": "San Cristóbal",
    "country": "VE"
  },
  {
    "code": "SCK",
    "name": "Stockton Metropolitan Airport",
    "city": "Stockton",
    "country": "US"
  },
  {
    "code": "SCL",
    "name": "Comodoro Arturo Merino Benítez International Airport",
    "city": "Santiago",
    "country": "CL"
  },
  {
    "code": "SCN",
    "name": "Saarbrücken Airport",
    "city": "Saarbrücken",
    "country": "DE"
  },
  {
    "code": "SCO",
    "name": "Aktau International Airport",
    "city": "Aktau",
    "country": "KZ"
  },
  {
    "code": "SCQ",
    "name": "Santiago-Rosalía de Castro Airport",
    "city": "Santiago de Compostela",
    "country": "ES"
  },
  {
    "code": "SCR",
    "name": "Scandinavian Mountains Airport",
    "city": "Malung-Sälen",
    "country": "SE"
  },
  {
    "code": "SCT",
    "name": "Socotra Airport",
    "city": "Mori",
    "country": "YE"
  },
  {
    "code": "SCU",
    "name": "Antonio Maceo International Airport",
    "city": "Santiago",
    "country": "CU"
  },
  {
    "code": "SCV",
    "name": "Suceava Ștefan cel Mare International Airport",
    "city": "Suceava",
    "country": "RO"
  },
  {
    "code": "SCW",
    "name": "Syktyvkar Airport",
    "city": "Syktyvkar",
    "country": "RU"
  },
  {
    "code": "SDB",
    "name": "Langebaanweg Airport",
    "city": "Langebaanweg",
    "country": "ZA"
  },
  {
    "code": "SDD",
    "name": "Lubango Mukanka International Airport",
    "city": "Lubango",
    "country": "AO"
  },
  {
    "code": "SDE",
    "name": "Vicecomodoro Angel D. La Paz Aragonés Airport",
    "city": "Santiago del Estero",
    "country": "AR"
  },
  {
    "code": "SDF",
    "name": "Louisville Muhammad Ali International Airport",
    "city": "Louisville",
    "country": "US"
  },
  {
    "code": "SDG",
    "name": "Sanandaj Airport",
    "city": null,
    "country": "IR"
  },
  {
    "code": "SDJ",
    "name": "Sendai Airport",
    "city": "Natori",
    "country": "JP"
  },
  {
    "code": "SDK",
    "name": "Sandakan Airport",
    "city": "Sandakan",
    "country": "MY"
  },
  {
    "code": "SDL",
    "name": "Sundsvall-Härnösand Airport",
    "city": "Sundsvall/ Härnösand",
    "country": "SE"
  },
  {
    "code": "SDM",
    "name": "Brown Field Municipal Airport",
    "city": "San Diego",
    "country": "US"
  },
  {
    "code": "SDP",
    "name": "Sand Point Airport",
    "city": "Sand Point",
    "country": "US"
  },
  {
    "code": "SDQ",
    "name": "Las Américas International Airport",
    "city": "Santo Domingo",
    "country": "DO"
  },
  {
    "code": "SDR",
    "name": "Seve Ballesteros-Santander Airport",
    "city": "Santander",
    "country": "ES"
  },
  {
    "code": "SDS",
    "name": "Sado Airport",
    "city": "Sado",
    "country": "JP"
  },
  {
    "code": "SDT",
    "name": "Saidu Sharif Airport",
    "city": "Saidu Sharif",
    "country": "PK"
  },
  {
    "code": "SDU",
    "name": "Santos Dumont Airport",
    "city": "Rio de Janeiro",
    "country": "BR"
  },
  {
    "code": "SDW",
    "name": "Sindhudurg Airport",
    "city": "Chipi",
    "country": "IN"
  },
  {
    "code": "SDY",
    "name": "Sidney - Richland Regional Airport",
    "city": "Sidney",
    "country": "US"
  },
  {
    "code": "SEA",
    "name": "Seattle–Tacoma International Airport",
    "city": "Seattle",
    "country": "US"
  },
  {
    "code": "SEB",
    "name": "Sabha Airport",
    "city": "Sabha",
    "country": "LY"
  },
  {
    "code": "SEK",
    "name": "Srednekolymsk Airport",
    "city": "Srednekolymsk",
    "country": "RU"
  },
  {
    "code": "SEN",
    "name": "London Southend Airport",
    "city": "Southend-on-Sea, Essex",
    "country": "GB"
  },
  {
    "code": "SES",
    "name": "Svetlogorsk Airport",
    "city": "Svetlogorsk",
    "country": "RU"
  },
  {
    "code": "SEZ",
    "name": "Seychelles International Airport",
    "city": "Victoria",
    "country": "SC"
  },
  {
    "code": "SFA",
    "name": "Sfax Thyna International Airport",
    "city": "Sfax",
    "country": "TN"
  },
  {
    "code": "SFB",
    "name": "Orlando Sanford International Airport",
    "city": "Orlando",
    "country": "US"
  },
  {
    "code": "SFD",
    "name": "San Fernando de Apure Las Flecheras National Airport",
    "city": "San Fernando de Apure",
    "country": "VE"
  },
  {
    "code": "SFE",
    "name": "San Fernando Airport",
    "city": "San Fernando",
    "country": "PH"
  },
  {
    "code": "SFF",
    "name": "Felts Field",
    "city": "Spokane",
    "country": "US"
  },
  {
    "code": "SFG",
    "name": "Grand Case-l'Espérance Airport",
    "city": "Grand Case",
    "country": "MF"
  },
  {
    "code": "SFJ",
    "name": "Kangerlussuaq International Airport",
    "city": "Kangerlussuaq",
    "country": "GL"
  },
  {
    "code": "SFN",
    "name": "Sauce Viejo Airport",
    "city": "Santa Fe",
    "country": "AR"
  },
  {
    "code": "SFO",
    "name": "San Francisco International Airport",
    "city": "San Francisco",
    "country": "US"
  },
  {
    "code": "SFS",
    "name": "Subic Bay International Airport / Naval Air Station Cubi Point",
    "city": "Olongapo",
    "country": "PH"
  },
  {
    "code": "SFT",
    "name": "Skellefteå Airport",
    "city": "Skellefteå",
    "country": "SE"
  },
  {
    "code": "SGC",
    "name": "Surgut International Airport",
    "city": "Surgut",
    "country": "RU"
  },
  {
    "code": "SGD",
    "name": "Sønderborg Airport",
    "city": "Sønderborg",
    "country": "DK"
  },
  {
    "code": "SGE",
    "name": "Siegerland Airport",
    "city": "Burbach",
    "country": "DE"
  },
  {
    "code": "SGF",
    "name": "Springfield Branson National Airport",
    "city": "Springfield",
    "country": "US"
  },
  {
    "code": "SGH",
    "name": "Springfield-Beckley Municipal Airport",
    "city": "Springfield",
    "country": "US"
  },
  {
    "code": "SGI",
    "name": "Mushaf Air Base",
    "city": "Sargodha",
    "country": "PK"
  },
  {
    "code": "SGL",
    "name": "Danilo Atienza Air Base",
    "city": "Cavite",
    "country": "PH"
  },
  {
    "code": "SGN",
    "name": "Tan Son Nhat International Airport",
    "city": "Ho Chi Minh City",
    "country": "VN"
  },
  {
    "code": "SGR",
    "name": "Sugar Land Regional Airport",
    "city": "Houston",
    "country": "US"
  },
  {
    "code": "SGU",
    "name": "St George Regional Airport",
    "city": "St George",
    "country": "US"
  },
  {
    "code": "SGZ",
    "name": "Songkhla Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "SHA",
    "name": "Shanghai Hongqiao International Airport",
    "city": "Shanghai (Minhang)",
    "country": "CN"
  },
  {
    "code": "SHB",
    "name": "Nakashibetsu Airport",
    "city": "Nakashibetsu",
    "country": "JP"
  },
  {
    "code": "SHD",
    "name": "Shenandoah Valley Regional Airport",
    "city": "Weyers Cave",
    "country": "US"
  },
  {
    "code": "SHE",
    "name": "Shenyang Taoxian International Airport",
    "city": "Hunnan, Shenyang",
    "country": "CN"
  },
  {
    "code": "SHI",
    "name": "Shimojishima Airport",
    "city": "Miyakojima",
    "country": "JP"
  },
  {
    "code": "SHJ",
    "name": "Sharjah International Airport",
    "city": "Sharjah",
    "country": "AE"
  },
  {
    "code": "SHL",
    "name": "Shillong Airport",
    "city": "Shillong",
    "country": "IN"
  },
  {
    "code": "SHM",
    "name": "Nanki Shirahama Airport",
    "city": "Shirahama",
    "country": "JP"
  },
  {
    "code": "SHO",
    "name": "King Mswati III International Airport",
    "city": "Mpaka",
    "country": "SZ"
  },
  {
    "code": "SHR",
    "name": "Sheridan County Airport",
    "city": "Sheridan",
    "country": "US"
  },
  {
    "code": "SHS",
    "name": "Jingzhou Shashi Airport",
    "city": "Jingzhou (Shashi)",
    "country": "CN"
  },
  {
    "code": "SHT",
    "name": "Shepparton Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "SHV",
    "name": "Shreveport Regional Airport",
    "city": "Shreveport",
    "country": "US"
  },
  {
    "code": "SHW",
    "name": "Sharurah Domestic Airport",
    "city": "Sharurah",
    "country": "SA"
  },
  {
    "code": "SIA",
    "name": "Xi'an Xiguan Airport",
    "city": "Xi'an (Baqiao)",
    "country": "CN"
  },
  {
    "code": "SID",
    "name": "Amílcar Cabral International Airport",
    "city": "Espargos",
    "country": "CV"
  },
  {
    "code": "SIG",
    "name": "Fernando Luis Ribas Dominicci Airport",
    "city": "San Juan",
    "country": "PR"
  },
  {
    "code": "SIJ",
    "name": "Siglufjörður Airport",
    "city": "Siglufjörður",
    "country": "IS"
  },
  {
    "code": "SIN",
    "name": "Singapore Changi Airport",
    "city": "Singapore",
    "country": "SG"
  },
  {
    "code": "SIO",
    "name": "Smithton Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "SIP",
    "name": "Simferopol International Airport",
    "city": "Simferopol",
    "country": "UA"
  },
  {
    "code": "SIR",
    "name": "Sion Airport",
    "city": "Sion",
    "country": "CH"
  },
  {
    "code": "SIS",
    "name": "Sishen Airport",
    "city": "Sishen",
    "country": "ZA"
  },
  {
    "code": "SIT",
    "name": "Sitka Rocky Gutierrez Airport",
    "city": "Sitka",
    "country": "US"
  },
  {
    "code": "SJC",
    "name": "Norman Y. Mineta San Jose International Airport",
    "city": "San Jose",
    "country": "US"
  },
  {
    "code": "SJD",
    "name": "Los Cabos International Airport",
    "city": "San José del Cabo",
    "country": "MX"
  },
  {
    "code": "SJE",
    "name": "Jorge E. Gonzalez Torres Airport",
    "city": "San José Del Guaviare",
    "country": "CO"
  },
  {
    "code": "SJI",
    "name": "San Jose Airport",
    "city": "San Jose",
    "country": "PH"
  },
  {
    "code": "SJJ",
    "name": "Sarajevo International Airport",
    "city": "Sarajevo",
    "country": "BA"
  },
  {
    "code": "SJK",
    "name": "Professor Urbano Ernesto Stumpf Airport",
    "city": "São José Dos Campos",
    "country": "BR"
  },
  {
    "code": "SJL",
    "name": "São Gabriel da Cachoeira Airport",
    "city": "São Gabriel da Cachoeira",
    "country": "BR"
  },
  {
    "code": "SJO",
    "name": "Juan Santamaría International Airport",
    "city": "San José (Alajuela)",
    "country": "CR"
  },
  {
    "code": "SJP",
    "name": "Prof. Eribelto Manoel Reino State Airport",
    "city": "São José do Rio Preto",
    "country": "BR"
  },
  {
    "code": "SJT",
    "name": "San Angelo Regional Mathis Field",
    "city": "San Angelo",
    "country": "US"
  },
  {
    "code": "SJU",
    "name": "Luis Munoz Marin International Airport",
    "city": "San Juan",
    "country": "PR"
  },
  {
    "code": "SJW",
    "name": "Shijiazhuang Zhengding International Airport",
    "city": "Shijiazhuang",
    "country": "CN"
  },
  {
    "code": "SJX",
    "name": "Sartaneja Airport",
    "city": "Sartaneja",
    "country": "BZ"
  },
  {
    "code": "SJY",
    "name": "Seinäjoki Airport",
    "city": "Seinäjoki / Ilmajoki",
    "country": "FI"
  },
  {
    "code": "SJZ",
    "name": "São Jorge Airport",
    "city": "Velas",
    "country": "PT"
  },
  {
    "code": "SKA",
    "name": "Fairchild Air Force Base",
    "city": "Spokane",
    "country": "US"
  },
  {
    "code": "SKB",
    "name": "Robert L. Bradshaw International Airport",
    "city": "Basseterre",
    "country": "KN"
  },
  {
    "code": "SKD",
    "name": "Samarkand International Airport",
    "city": "Samarkand",
    "country": "UZ"
  },
  {
    "code": "SKF",
    "name": "Lackland Air Force Base",
    "city": "San Antonio",
    "country": "US"
  },
  {
    "code": "SKG",
    "name": "Thessaloniki Macedonia International Airport",
    "city": "Thessaloniki",
    "country": "GR"
  },
  {
    "code": "SKN",
    "name": "Stokmarknes Airport, Skagen",
    "city": "Hadsel",
    "country": "NO"
  },
  {
    "code": "SKO",
    "name": "Sadiq Abubakar III International Airport",
    "city": "Sokoto",
    "country": "NG"
  },
  {
    "code": "SKP",
    "name": "Skopje International Airport",
    "city": "Ilinden",
    "country": "MK"
  },
  {
    "code": "SKS",
    "name": "Skrydstrup Air Base",
    "city": "Vojens",
    "country": "DK"
  },
  {
    "code": "SKT",
    "name": "Sialkot International Airport",
    "city": "Sialkot",
    "country": "PK"
  },
  {
    "code": "SKV",
    "name": "Saint Catherine International Airport",
    "city": "Saint Catherine",
    "country": "EG"
  },
  {
    "code": "SKX",
    "name": "Saransk International Airport",
    "city": "Saransk",
    "country": "RU"
  },
  {
    "code": "SKZ",
    "name": "Sukkur Airport",
    "city": "Mirpur Khas",
    "country": "PK"
  },
  {
    "code": "SLA",
    "name": "Martin Miguel De Guemes International Airport",
    "city": "Salta",
    "country": "AR"
  },
  {
    "code": "SLC",
    "name": "Salt Lake City International Airport",
    "city": "Salt Lake City",
    "country": "US"
  },
  {
    "code": "SLD",
    "name": "Sliač Airport",
    "city": "Sliač",
    "country": "SK"
  },
  {
    "code": "SLE",
    "name": "Salem-Willamette Valley Airport/McNary Field",
    "city": "Salem",
    "country": "US"
  },
  {
    "code": "SLK",
    "name": "Adirondack Regional Airport",
    "city": "Saranac Lake",
    "country": "US"
  },
  {
    "code": "SLL",
    "name": "Salalah International Airport",
    "city": "Salalah",
    "country": "OM"
  },
  {
    "code": "SLM",
    "name": "Salamanca Airport",
    "city": "Salamanca",
    "country": "ES"
  },
  {
    "code": "SLN",
    "name": "Salina Municipal Airport",
    "city": "Salina",
    "country": "US"
  },
  {
    "code": "SLP",
    "name": "Ponciano Arriaga International Airport",
    "city": "San Luis Potosí",
    "country": "MX"
  },
  {
    "code": "SLU",
    "name": "George F. L. Charles Airport",
    "city": "Castries",
    "country": "LC"
  },
  {
    "code": "SLW",
    "name": "Plan De Guadalupe International Airport",
    "city": "Saltillo",
    "country": "MX"
  },
  {
    "code": "SLY",
    "name": "Salekhard Airport",
    "city": "Salekhard",
    "country": "RU"
  },
  {
    "code": "SLZ",
    "name": "Marechal Cunha Machado International Airport",
    "city": "São Luís",
    "country": "BR"
  },
  {
    "code": "SMA",
    "name": "Santa Maria Airport",
    "city": "Vila do Porto",
    "country": "PT"
  },
  {
    "code": "SME",
    "name": "Lake Cumberland Regional Airport",
    "city": "Somerset",
    "country": "US"
  },
  {
    "code": "SMF",
    "name": "Sacramento International Airport",
    "city": "Sacramento",
    "country": "US"
  },
  {
    "code": "SMI",
    "name": "Samos Airport",
    "city": "Samos Island",
    "country": "GR"
  },
  {
    "code": "SML",
    "name": "Stella Maris Airport",
    "city": "Stella Maris",
    "country": "BS"
  },
  {
    "code": "SMN",
    "name": "Lemhi County Airport",
    "city": "Salmon",
    "country": "US"
  },
  {
    "code": "SMO",
    "name": "Santa Monica Municipal Airport",
    "city": "Santa Monica",
    "country": "US"
  },
  {
    "code": "SMR",
    "name": "Simón Bolívar International Airport",
    "city": "Santa Marta",
    "country": "CO"
  },
  {
    "code": "SMS",
    "name": "Sainte Marie Airport",
    "city": "Vohilava",
    "country": "MG"
  },
  {
    "code": "SMV",
    "name": "Samedan Airport",
    "city": "Samedan",
    "country": "CH"
  },
  {
    "code": "SMW",
    "name": "Smara Airport",
    "city": "Smara",
    "country": "EH"
  },
  {
    "code": "SMX",
    "name": "Santa Maria Public Airport Captain G Allan Hancock Field",
    "city": "Santa Maria",
    "country": "US"
  },
  {
    "code": "SNA",
    "name": "John Wayne Orange County International Airport",
    "city": "Santa Ana",
    "country": "US"
  },
  {
    "code": "SNB",
    "name": "Snake Bay Airport",
    "city": "Milikapiti",
    "country": "AU"
  },
  {
    "code": "SNC",
    "name": "General Ulpiano Paez International Airport",
    "city": "Salinas/La Libertad",
    "country": "EC"
  },
  {
    "code": "SNE",
    "name": "Preguiça Airport",
    "city": "Preguiça",
    "country": "CV"
  },
  {
    "code": "SNF",
    "name": "Sub Teniente Nestor Arias Airport",
    "city": "San Felipe",
    "country": "VE"
  },
  {
    "code": "SNJ",
    "name": "San Julián Air Base",
    "city": "Sandino",
    "country": "CU"
  },
  {
    "code": "SNN",
    "name": "Shannon Airport",
    "city": "Shannon",
    "country": "IE"
  },
  {
    "code": "SNO",
    "name": "Sakon Nakhon Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "SNP",
    "name": "St Paul Island Airport",
    "city": "St Paul Island",
    "country": "US"
  },
  {
    "code": "SNR",
    "name": "Saint-Nazaire-Montoir Airport",
    "city": "Saint-Nazaire/Montoir",
    "country": "FR"
  },
  {
    "code": "SNS",
    "name": "Salinas Municipal Airport",
    "city": "Salinas",
    "country": "US"
  },
  {
    "code": "SNU",
    "name": "Abel Santamaria International Airport",
    "city": "Santa Clara",
    "country": "CU"
  },
  {
    "code": "SNV",
    "name": "Santa Elena de Uairén Airport",
    "city": "Santa Elena de Uairén",
    "country": "VE"
  },
  {
    "code": "SNW",
    "name": "Thandwe Airport",
    "city": "Thandwe",
    "country": "MM"
  },
  {
    "code": "SNY",
    "name": "Sidney Municipal Airport Lloyd W Carr Field",
    "city": "Sidney",
    "country": "US"
  },
  {
    "code": "SNZ",
    "name": "Santa Cruz Air Force Base",
    "city": "Rio de Janeiro",
    "country": "BR"
  },
  {
    "code": "SOB",
    "name": "Hévíz–Balaton Airport",
    "city": "Sármellék",
    "country": "HU"
  },
  {
    "code": "SOC",
    "name": "Adisumarmo Airport",
    "city": "Surakarta",
    "country": "ID"
  },
  {
    "code": "SOF",
    "name": "Sofia Airport",
    "city": "Sofia",
    "country": "BG"
  },
  {
    "code": "SOJ",
    "name": "Sørkjosen Airport",
    "city": "Sørkjosen",
    "country": "NO"
  },
  {
    "code": "SOM",
    "name": "San Tomé Airport",
    "city": "El Tigre",
    "country": "VE"
  },
  {
    "code": "SON",
    "name": "Santo Pekoa International Airport",
    "city": "Luganville",
    "country": "VU"
  },
  {
    "code": "SOO",
    "name": "Söderhamn Airport",
    "city": "Söderhamn",
    "country": "SE"
  },
  {
    "code": "SOQ",
    "name": "Domine Eduard Osok Airport",
    "city": "Sorong",
    "country": "ID"
  },
  {
    "code": "SOT",
    "name": "Sodankyla Airport",
    "city": "Sodankyla",
    "country": "FI"
  },
  {
    "code": "SOU",
    "name": "Southampton Airport",
    "city": "Southampton",
    "country": "GB"
  },
  {
    "code": "SOW",
    "name": "Show Low Regional Airport",
    "city": "Show Low",
    "country": "US"
  },
  {
    "code": "SOZ",
    "name": "Solenzara (BA 126) Air Base",
    "city": "Solenzara",
    "country": "FR"
  },
  {
    "code": "SPC",
    "name": "La Palma Airport",
    "city": "Sta Cruz de la Palma, La Palma Island",
    "country": "ES"
  },
  {
    "code": "SPD",
    "name": "Saidpur Airport",
    "city": "Saidpur",
    "country": "BD"
  },
  {
    "code": "SPI",
    "name": "Abraham Lincoln Capital Airport",
    "city": "Springfield",
    "country": "US"
  },
  {
    "code": "SPM",
    "name": "Spangdahlem Air Base",
    "city": "Trier",
    "country": "DE"
  },
  {
    "code": "SPN",
    "name": "Saipan International Airport",
    "city": "I Fadang, Saipan",
    "country": "MP"
  },
  {
    "code": "SPP",
    "name": "Menongue Airport",
    "city": "Menongue",
    "country": "AO"
  },
  {
    "code": "SPR",
    "name": "John Greif II Airport",
    "city": "San Pedro",
    "country": "BZ"
  },
  {
    "code": "SPS",
    "name": "Wichita Falls Municipal Airport / Sheppard Air Force Base",
    "city": "Wichita Falls",
    "country": "US"
  },
  {
    "code": "SPU",
    "name": "Split Saint Jerome Airport",
    "city": "Split",
    "country": "HR"
  },
  {
    "code": "SPX",
    "name": "Sphinx International Airport",
    "city": "Al Jiza",
    "country": "EG"
  },
  {
    "code": "SPY",
    "name": "San Pedro Airport",
    "city": null,
    "country": "CI"
  },
  {
    "code": "SQD",
    "name": "Shangrao Sanqingshan Airport",
    "city": "Shangrao (Hengfeng)",
    "country": "CN"
  },
  {
    "code": "SQG",
    "name": "Tebelian Airport",
    "city": "Sintang",
    "country": "ID"
  },
  {
    "code": "SQJ",
    "name": "Sanming Shaxian Airport",
    "city": "Sanming (Sha)",
    "country": "CN"
  },
  {
    "code": "SQL",
    "name": "San Carlos Airport",
    "city": "San Carlos",
    "country": "US"
  },
  {
    "code": "SQO",
    "name": "Storuman Airport",
    "city": "Storuman",
    "country": "SE"
  },
  {
    "code": "SQQ",
    "name": "Šiauliai International Airport",
    "city": "Šiauliai",
    "country": "LT"
  },
  {
    "code": "SQW",
    "name": "Skive Airport",
    "city": "Skive",
    "country": "DK"
  },
  {
    "code": "SRE",
    "name": "Alcantarí International Airport",
    "city": "Sucre",
    "country": "BO"
  },
  {
    "code": "SRG",
    "name": "Jenderal Ahmad Yani Airport",
    "city": "Semarang",
    "country": "ID"
  },
  {
    "code": "SRP",
    "name": "Stord Airport, Sørstokken",
    "city": "Leirvik",
    "country": "NO"
  },
  {
    "code": "SRQ",
    "name": "Sarasota Bradenton International Airport",
    "city": "Sarasota/Bradenton",
    "country": "US"
  },
  {
    "code": "SRT",
    "name": "Soroti Airport",
    "city": "Soroti",
    "country": "UG"
  },
  {
    "code": "SRX",
    "name": "Sirt International Airport / Ghardabiya Airbase",
    "city": "Sirt",
    "country": "LY"
  },
  {
    "code": "SRY",
    "name": "Sari Dasht-e Naz International Airport",
    "city": "Sari",
    "country": "IR"
  },
  {
    "code": "SRZ",
    "name": "El Trompillo Airport",
    "city": "Santa Cruz",
    "country": "BO"
  },
  {
    "code": "SSA",
    "name": "Deputado Luiz Eduardo Magalhães International Airport",
    "city": "Salvador",
    "country": "BR"
  },
  {
    "code": "SSC",
    "name": "Shaw Air Force Base",
    "city": "Sumter",
    "country": "US"
  },
  {
    "code": "SSE",
    "name": "Solapur Airport",
    "city": "Solapur",
    "country": "IN"
  },
  {
    "code": "SSF",
    "name": "Stinson Municipal Airport",
    "city": "San Antonio",
    "country": "US"
  },
  {
    "code": "SSG",
    "name": "Malabo International Airport",
    "city": "Malabo",
    "country": "GQ"
  },
  {
    "code": "SSH",
    "name": "Sharm El Sheikh International Airport",
    "city": "Sharm El Sheikh",
    "country": "EG"
  },
  {
    "code": "SSI",
    "name": "St Simons Island Airport",
    "city": "St Simons Island",
    "country": "US"
  },
  {
    "code": "SSJ",
    "name": "Sandnessjøen Airport, Stokka",
    "city": "Alstahaug",
    "country": "NO"
  },
  {
    "code": "SSN",
    "name": "Seoul Air Base (K-16)",
    "city": "Seongnam",
    "country": "KR"
  },
  {
    "code": "SST",
    "name": "Santa Teresita Airport",
    "city": "Santa Teresita",
    "country": "AR"
  },
  {
    "code": "SSY",
    "name": "Mbanza Congo Airport",
    "city": "Mbanza Congo",
    "country": "AO"
  },
  {
    "code": "SSZ",
    "name": "Santos Nero Moura Air Base / Guarujá Airport",
    "city": "Guarujá",
    "country": "BR"
  },
  {
    "code": "STA",
    "name": "Stauning Vestjylland  Airport",
    "city": "Skjern",
    "country": "DK"
  },
  {
    "code": "STB",
    "name": "Miguel Urdaneta Fernández Airport",
    "city": "San Carlos del Zulia",
    "country": "VE"
  },
  {
    "code": "STC",
    "name": "Saint Cloud Regional Airport",
    "city": "Saint Cloud",
    "country": "US"
  },
  {
    "code": "STD",
    "name": "Mayor Buenaventura Vivas International Airport",
    "city": "Santo Domingo",
    "country": "VE"
  },
  {
    "code": "STG",
    "name": "St George Airport",
    "city": "St George",
    "country": "US"
  },
  {
    "code": "STI",
    "name": "Cibao International Airport",
    "city": "Santiago",
    "country": "DO"
  },
  {
    "code": "STJ",
    "name": "Rosecrans Memorial Airport",
    "city": "St Joseph",
    "country": "US"
  },
  {
    "code": "STL",
    "name": "St. Louis Lambert International Airport",
    "city": "St Louis",
    "country": "US"
  },
  {
    "code": "STM",
    "name": "Santarém - Maestro Wilson Fonseca International Airport",
    "city": "Santarém",
    "country": "BR"
  },
  {
    "code": "STN",
    "name": "London Stansted Airport",
    "city": "London, Essex",
    "country": "GB"
  },
  {
    "code": "STP",
    "name": "Saint Paul Downtown Holman Field",
    "city": "Saint Paul",
    "country": "US"
  },
  {
    "code": "STR",
    "name": "Stuttgart Airport",
    "city": "Stuttgart",
    "country": "DE"
  },
  {
    "code": "STS",
    "name": "Charles M. Schulz Sonoma County Airport",
    "city": "Santa Rosa",
    "country": "US"
  },
  {
    "code": "STT",
    "name": "Cyril E. King Airport",
    "city": "Charlotte Amalie",
    "country": "VI"
  },
  {
    "code": "STV",
    "name": "Surat International Airport",
    "city": "Surat",
    "country": "IN"
  },
  {
    "code": "STW",
    "name": "Stavropol Shpakovskoye Airport",
    "city": "Stavropol",
    "country": "RU"
  },
  {
    "code": "STX",
    "name": "Henry E. Rohlsen Airport",
    "city": "Christiansted",
    "country": "VI"
  },
  {
    "code": "STY",
    "name": "Nueva Hesperides International Airport",
    "city": "Salto",
    "country": "UY"
  },
  {
    "code": "SUB",
    "name": "Juanda International Airport",
    "city": "Surabaya",
    "country": "ID"
  },
  {
    "code": "SUF",
    "name": "Lamezia Terme Sant'Eufemia International Airport",
    "city": "Lamezia Terme (CZ)",
    "country": "IT"
  },
  {
    "code": "SUG",
    "name": "Surigao Airport",
    "city": "Surigao City",
    "country": "PH"
  },
  {
    "code": "SUI",
    "name": "Vladislav Ardzinba Sukhum International Airport",
    "city": "Sukhumi",
    "country": "GE"
  },
  {
    "code": "SUJ",
    "name": "Satu Mare International Airport",
    "city": "Satu Mare",
    "country": "RO"
  },
  {
    "code": "SUL",
    "name": "Sui Airport",
    "city": "Sui",
    "country": "PK"
  },
  {
    "code": "SUN",
    "name": "Friedman Memorial Airport",
    "city": "Hailey",
    "country": "US"
  },
  {
    "code": "SUS",
    "name": "Spirit of St Louis Airport",
    "city": "St Louis",
    "country": "US"
  },
  {
    "code": "SUU",
    "name": "Travis Air Force Base",
    "city": "Fairfield",
    "country": "US"
  },
  {
    "code": "SUV",
    "name": "Nausori International Airport",
    "city": "Nausori",
    "country": "FJ"
  },
  {
    "code": "SUX",
    "name": "Sioux Gateway Airport / Brigadier General Bud Day Field",
    "city": "Sioux City",
    "country": "US"
  },
  {
    "code": "SVA",
    "name": "Savoonga Airport",
    "city": "Savoonga",
    "country": "US"
  },
  {
    "code": "SVB",
    "name": "Sambava Airport",
    "city": "Sambava",
    "country": "MG"
  },
  {
    "code": "SVC",
    "name": "Grant County Airport",
    "city": "Silver City",
    "country": "US"
  },
  {
    "code": "SVD",
    "name": "Argyle International Airport",
    "city": "Kingstown",
    "country": "VC"
  },
  {
    "code": "SVG",
    "name": "Stavanger Airport, Sola",
    "city": "Stavanger",
    "country": "NO"
  },
  {
    "code": "SVI",
    "name": "Eduardo Falla Solano Airport",
    "city": "San Vicente Del Caguán",
    "country": "CO"
  },
  {
    "code": "SVJ",
    "name": "Svolvær Airport, Helle",
    "city": "Svolvær",
    "country": "NO"
  },
  {
    "code": "SVL",
    "name": "Savonlinna Airport",
    "city": "Savonlinna",
    "country": "FI"
  },
  {
    "code": "SVN",
    "name": "Hunter Army Air Field",
    "city": "Savannah",
    "country": "US"
  },
  {
    "code": "SVO",
    "name": "Sheremetyevo International Airport",
    "city": "Moscow",
    "country": "RU"
  },
  {
    "code": "SVP",
    "name": "Kuito Airport",
    "city": "Kuito",
    "country": "AO"
  },
  {
    "code": "SVQ",
    "name": "Seville Airport",
    "city": "Seville",
    "country": "ES"
  },
  {
    "code": "SVW",
    "name": "Sparrevohn LRRS Airport",
    "city": "Sparrevohn",
    "country": "US"
  },
  {
    "code": "SVX",
    "name": "Koltsovo Airport",
    "city": "Yekaterinburg",
    "country": "RU"
  },
  {
    "code": "SVZ",
    "name": "Juan Vicente Gómez International Airport",
    "city": "San Antonio del Tachira",
    "country": "VE"
  },
  {
    "code": "SWA",
    "name": "Jieyang Chaoshan International Airport",
    "city": "Jieyang (Rongcheng)",
    "country": "CN"
  },
  {
    "code": "SWC",
    "name": "Stawell Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "SWD",
    "name": "Seward Airport",
    "city": "Seward",
    "country": "US"
  },
  {
    "code": "SWF",
    "name": "New York Stewart International Airport",
    "city": "Newburgh",
    "country": "US"
  },
  {
    "code": "SWH",
    "name": "Swan Hill Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "SWO",
    "name": "Stillwater Regional Airport",
    "city": "Stillwater",
    "country": "US"
  },
  {
    "code": "SWS",
    "name": "Swansea Airport",
    "city": "Swansea",
    "country": "GB"
  },
  {
    "code": "SWT",
    "name": "Strezhevoy Airport",
    "city": "Strezhevoy",
    "country": "RU"
  },
  {
    "code": "SWU",
    "name": "Suwon Airport",
    "city": "Suwon",
    "country": "KR"
  },
  {
    "code": "SWV",
    "name": "Severo-Evensk Airport",
    "city": "Evensk",
    "country": "RU"
  },
  {
    "code": "SXB",
    "name": "Strasbourg Airport",
    "city": "Strasbourg",
    "country": "FR"
  },
  {
    "code": "SXE",
    "name": "West Sale Airport",
    "city": "Sale",
    "country": "AU"
  },
  {
    "code": "SXI",
    "name": "Siri Airport",
    "city": "Siri",
    "country": "IR"
  },
  {
    "code": "SXJ",
    "name": "Shanshan Airport",
    "city": "Shanshan",
    "country": "CN"
  },
  {
    "code": "SXL",
    "name": "Sligo Airport",
    "city": "Sligo",
    "country": "IE"
  },
  {
    "code": "SXM",
    "name": "Princess Juliana International Airport",
    "city": "Sint Maarten",
    "country": "SX"
  },
  {
    "code": "SXN",
    "name": "Sua Pan Airport",
    "city": "Sowa",
    "country": "BW"
  },
  {
    "code": "SXQ",
    "name": "Soldotna Airport",
    "city": "Soldotna",
    "country": "US"
  },
  {
    "code": "SXR",
    "name": "Sheikh ul Alam International Airport",
    "city": "Srinagar",
    "country": "IN"
  },
  {
    "code": "SXV",
    "name": "Salem Airport",
    "city": "Salem",
    "country": "IN"
  },
  {
    "code": "SXZ",
    "name": "Siirt Airport",
    "city": "Siirt",
    "country": "TR"
  },
  {
    "code": "SYA",
    "name": "Eareckson Air Station",
    "city": "Shemya",
    "country": "US"
  },
  {
    "code": "SYD",
    "name": "Sydney Kingsford Smith International Airport",
    "city": "Sydney (Mascot)",
    "country": "AU"
  },
  {
    "code": "SYJ",
    "name": "Sirjan Airport",
    "city": "Sirjan",
    "country": "IR"
  },
  {
    "code": "SYO",
    "name": "Shonai Airport",
    "city": "Shonai",
    "country": "JP"
  },
  {
    "code": "SYP",
    "name": "Ruben Cantu Airport",
    "city": "Santiago",
    "country": "PA"
  },
  {
    "code": "SYQ",
    "name": "Tobías Bolaños International Airport",
    "city": "San Jose",
    "country": "CR"
  },
  {
    "code": "SYR",
    "name": "Syracuse Hancock International Airport",
    "city": "Syracuse",
    "country": "US"
  },
  {
    "code": "SYS",
    "name": "Saskylakh Airport",
    "city": "Saskylakh",
    "country": "RU"
  },
  {
    "code": "SYT",
    "name": "Saint-Yan Airport",
    "city": "L'Hôpital-le-Mercier, Saône-et-Loire",
    "country": "FR"
  },
  {
    "code": "SYW",
    "name": "Sehwan Sharif Airport",
    "city": "Sehwan Sharif",
    "country": "PK"
  },
  {
    "code": "SYX",
    "name": "Sanya Phoenix International Airport",
    "city": "Sanya (Tianya)",
    "country": "CN"
  },
  {
    "code": "SYY",
    "name": "Stornoway Airport",
    "city": "Stornoway, Western Isles",
    "country": "GB"
  },
  {
    "code": "SYZ",
    "name": "Shiraz Shahid Dastghaib International Airport",
    "city": "Shiraz",
    "country": "IR"
  },
  {
    "code": "SZA",
    "name": "Soyo Airport",
    "city": "Soyo",
    "country": "AO"
  },
  {
    "code": "SZB",
    "name": "Sultan Abdul Aziz Shah International Airport",
    "city": "Subang",
    "country": "MY"
  },
  {
    "code": "SZF",
    "name": "Samsun-Çarşamba Airport",
    "city": "Samsun",
    "country": "TR"
  },
  {
    "code": "SZG",
    "name": "Salzburg Airport",
    "city": "Salzburg",
    "country": "AT"
  },
  {
    "code": "SZJ",
    "name": "Siguanea Airport",
    "city": "Isla de la Juventud",
    "country": "CU"
  },
  {
    "code": "SZK",
    "name": "Skukuza Airport",
    "city": "Skukuza",
    "country": "ZA"
  },
  {
    "code": "SZL",
    "name": "Whiteman Air Force Base",
    "city": "Knob Noster",
    "country": "US"
  },
  {
    "code": "SZV",
    "name": "Suzhou Guangfu Airport",
    "city": "Suzhou",
    "country": "CN"
  },
  {
    "code": "SZX",
    "name": "Shenzhen Bao'an International Airport",
    "city": "Shenzhen (Bao'an)",
    "country": "CN"
  },
  {
    "code": "SZY",
    "name": "Olsztyn-Mazury Airport",
    "city": "Szymany",
    "country": "PL"
  },
  {
    "code": "SZZ",
    "name": "Solidarity Szczecin–Goleniów Airport",
    "city": "Glewice",
    "country": "PL"
  },
  {
    "code": "TAB",
    "name": "A.N.R. Robinson International Airport",
    "city": "Scarborough",
    "country": "TT"
  },
  {
    "code": "TAC",
    "name": "Daniel Z. Romualdez Airport",
    "city": "Tacloban City",
    "country": "PH"
  },
  {
    "code": "TAE",
    "name": "Daegu International Airport",
    "city": "Daegu",
    "country": "KR"
  },
  {
    "code": "TAF",
    "name": "Oran Tafraoui Airport",
    "city": "Tafraoui",
    "country": "DZ"
  },
  {
    "code": "TAG",
    "name": "Bohol-Panglao International Airport",
    "city": "Panglao",
    "country": "PH"
  },
  {
    "code": "TAH",
    "name": "Whitegrass Airport",
    "city": "Tanna Island",
    "country": "VU"
  },
  {
    "code": "TAI",
    "name": "Taiz International Airport",
    "city": "Taiz",
    "country": "YE"
  },
  {
    "code": "TAK",
    "name": "Takamatsu Airport",
    "city": "Takamatsu",
    "country": "JP"
  },
  {
    "code": "TAM",
    "name": "General Francisco Javier Mina International Airport",
    "city": "Tampico",
    "country": "MX"
  },
  {
    "code": "TAO",
    "name": "Qingdao Jiaodong International Airport",
    "city": "Qingdao (Jiaozhou)",
    "country": "CN"
  },
  {
    "code": "TAP",
    "name": "Tapachula International Airport",
    "city": "Tapachula",
    "country": "MX"
  },
  {
    "code": "TAR",
    "name": "Taranto-Grottaglie Marcello Arlotta Airport",
    "city": "Grottaglie",
    "country": "IT"
  },
  {
    "code": "TAS",
    "name": "Tashkent International Airport",
    "city": "Tashkent",
    "country": "UZ"
  },
  {
    "code": "TAT",
    "name": "Poprad-Tatry Airport",
    "city": "Poprad",
    "country": "SK"
  },
  {
    "code": "TAY",
    "name": "Tartu Airport",
    "city": "Reola",
    "country": "EE"
  },
  {
    "code": "TAZ",
    "name": "Daşoguz Airport",
    "city": "Daşoguz",
    "country": "TM"
  },
  {
    "code": "TBB",
    "name": "Dong Tac Airport",
    "city": "Tuy Hoa",
    "country": "VN"
  },
  {
    "code": "TBF",
    "name": "Tabiteuea North Airport",
    "city": null,
    "country": "KI"
  },
  {
    "code": "TBH",
    "name": "Tugdan Airport",
    "city": "Tablas Island",
    "country": "PH"
  },
  {
    "code": "TBI",
    "name": "New Bight Airport",
    "city": "Cat Island",
    "country": "BS"
  },
  {
    "code": "TBJ",
    "name": "Tabarka-Aïn Draham International Airport",
    "city": "Tabarka",
    "country": "TN"
  },
  {
    "code": "TBN",
    "name": "Waynesville-St. Robert Regional Airport-Forney Field",
    "city": "Fort Leonard Wood",
    "country": "US"
  },
  {
    "code": "TBP",
    "name": "Captain Pedro Canga Rodríguez International Airport",
    "city": "Tumbes",
    "country": "PE"
  },
  {
    "code": "TBS",
    "name": "Tbilisi International Airport",
    "city": "Tbilisi",
    "country": "GE"
  },
  {
    "code": "TBT",
    "name": "Tabatinga Airport",
    "city": "Tabatinga",
    "country": "BR"
  },
  {
    "code": "TBU",
    "name": "Fua'amotu International Airport",
    "city": "Nuku'alofa",
    "country": "TO"
  },
  {
    "code": "TBW",
    "name": "Donskoye Airport",
    "city": "Tambov",
    "country": "RU"
  },
  {
    "code": "TBZ",
    "name": "Tabriz International Airport",
    "city": "Tabriz",
    "country": "IR"
  },
  {
    "code": "TCA",
    "name": "Tennant Creek Airport",
    "city": "Tennant Creek",
    "country": "AU"
  },
  {
    "code": "TCB",
    "name": "Treasure Cay Airport",
    "city": "Treasure Cay",
    "country": "BS"
  },
  {
    "code": "TCC",
    "name": "Tucumcari Municipal Airport",
    "city": "Tucumcari",
    "country": "US"
  },
  {
    "code": "TCE",
    "name": "Tulcea Danube Delta Airport",
    "city": "Mihail Kogălniceanu",
    "country": "RO"
  },
  {
    "code": "TCL",
    "name": "Tuscaloosa National Airport",
    "city": "Tuscaloosa",
    "country": "US"
  },
  {
    "code": "TCM",
    "name": "McChord Air Force Base",
    "city": "Tacoma",
    "country": "US"
  },
  {
    "code": "TCO",
    "name": "La Florida Airport",
    "city": "Tumaco",
    "country": "CO"
  },
  {
    "code": "TCP",
    "name": "Taba International Airport",
    "city": "Taba",
    "country": "EG"
  },
  {
    "code": "TCQ",
    "name": "Coronel FAP Carlos Ciriani Santa Rosa International Airport",
    "city": "Tacna",
    "country": "PE"
  },
  {
    "code": "TCS",
    "name": "Truth or Consequences Municipal Airport",
    "city": "Truth or Consequences",
    "country": "US"
  },
  {
    "code": "TCX",
    "name": "Tabas Airport",
    "city": "Tabas",
    "country": "IR"
  },
  {
    "code": "TCZ",
    "name": "Tengchong Tuofeng Airport",
    "city": "Baoshan (Tengchong)",
    "country": "CN"
  },
  {
    "code": "TDD",
    "name": "Teniente Av. Jorge Henrich Arauz Airport",
    "city": "Trinidad",
    "country": "BO"
  },
  {
    "code": "TDG",
    "name": "Tandag Airport",
    "city": "Tandag",
    "country": "PH"
  },
  {
    "code": "TDK",
    "name": "Taldykorgan Airport",
    "city": "Taldykorgan",
    "country": "KZ"
  },
  {
    "code": "TDL",
    "name": "Héroes de Malvinas Airport",
    "city": "Tandil",
    "country": "AR"
  },
  {
    "code": "TDX",
    "name": "Trat Airport",
    "city": "Laem Ngop",
    "country": "TH"
  },
  {
    "code": "TEA",
    "name": "Tela Airport",
    "city": "Tela",
    "country": "HN"
  },
  {
    "code": "TEB",
    "name": "Teterboro Airport",
    "city": "Teterboro",
    "country": "US"
  },
  {
    "code": "TEC",
    "name": "Telêmaco Borba Airport",
    "city": "Telêmaco Borba",
    "country": "BR"
  },
  {
    "code": "TED",
    "name": "Thisted Airport",
    "city": "Thisted",
    "country": "DK"
  },
  {
    "code": "TEE",
    "name": "Cheikh Larbi Tébessi Airport",
    "city": "Tébessi",
    "country": "DZ"
  },
  {
    "code": "TEF",
    "name": "Telfer Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "TEM",
    "name": "Temora Airport",
    "city": "Temora",
    "country": "AU"
  },
  {
    "code": "TEN",
    "name": "Tongren Fenghuang Airport",
    "city": "Tongren (Daxing)",
    "country": "CN"
  },
  {
    "code": "TEQ",
    "name": "Tekirdağ Çorlu Airport",
    "city": "Çorlu",
    "country": "TR"
  },
  {
    "code": "TER",
    "name": "Lajes Airport",
    "city": "Praia da Vitória",
    "country": "PT"
  },
  {
    "code": "TET",
    "name": "Chingozi Airport",
    "city": "Tete",
    "country": "MZ"
  },
  {
    "code": "TEU",
    "name": "Manapouri Airport",
    "city": null,
    "country": "NZ"
  },
  {
    "code": "TEV",
    "name": "Teruel Airport",
    "city": "Teruel",
    "country": "ES"
  },
  {
    "code": "TEX",
    "name": "Telluride Regional Airport",
    "city": "Telluride",
    "country": "US"
  },
  {
    "code": "TEZ",
    "name": "Tezpur Airport",
    "city": null,
    "country": "IN"
  },
  {
    "code": "TFF",
    "name": "Tefé Airport",
    "city": "Tefé",
    "country": "BR"
  },
  {
    "code": "TFN",
    "name": "Tenerife Norte-Ciudad de La Laguna Airport",
    "city": "Tenerife",
    "country": "ES"
  },
  {
    "code": "TFS",
    "name": "Tenerife Sur Airport",
    "city": "Tenerife",
    "country": "ES"
  },
  {
    "code": "TFU",
    "name": "Chengdu Tianfu International Airport",
    "city": "Chengdu (Jianyang)",
    "country": "CN"
  },
  {
    "code": "TGA",
    "name": "Tengah Air Base",
    "city": "Western Water Catchment",
    "country": "SG"
  },
  {
    "code": "TGD",
    "name": "Podgorica Airport / Podgorica Golubovci Airbase",
    "city": "Podgorica",
    "country": "ME"
  },
  {
    "code": "TGG",
    "name": "Sultan Mahmud Airport",
    "city": "Kuala Terengganu",
    "country": "MY"
  },
  {
    "code": "TGJ",
    "name": "Tiga Airport",
    "city": "Tiga",
    "country": "NC"
  },
  {
    "code": "TGK",
    "name": "Taganrog Yuzhny Airport",
    "city": "Taganrog",
    "country": "RU"
  },
  {
    "code": "TGM",
    "name": "Târgu Mureş Transilvania International Airport",
    "city": "Recea",
    "country": "RO"
  },
  {
    "code": "TGN",
    "name": "Latrobe Valley Airport",
    "city": "Morwell",
    "country": "AU"
  },
  {
    "code": "TGO",
    "name": "Tongliao Airport",
    "city": "Tongliao",
    "country": "CN"
  },
  {
    "code": "TGP",
    "name": "Podkamennaya Tunguska Airport",
    "city": "Bor",
    "country": "RU"
  },
  {
    "code": "TGR",
    "name": "Touggourt Sidi Madhi Airport",
    "city": "Touggourt",
    "country": "DZ"
  },
  {
    "code": "TGT",
    "name": "Tanga Airport",
    "city": "Tanga",
    "country": "TZ"
  },
  {
    "code": "TGU",
    "name": "Toncontín International Airport",
    "city": "Tegucigalpa",
    "country": "HN"
  },
  {
    "code": "TGZ",
    "name": "Angel Albino Corzo International Airport",
    "city": "Tuxtla Gutiérrez",
    "country": "MX"
  },
  {
    "code": "THE",
    "name": "Senador Petrônio Portela Airport",
    "city": "Teresina",
    "country": "BR"
  },
  {
    "code": "THG",
    "name": "Thangool Airport",
    "city": "Biloela",
    "country": "AU"
  },
  {
    "code": "THL",
    "name": "Tachileik Airport",
    "city": "Tachileik",
    "country": "MM"
  },
  {
    "code": "THN",
    "name": "Trollhättan-Vänersborg Airport",
    "city": "Trollhättan",
    "country": "SE"
  },
  {
    "code": "THQ",
    "name": "Tianshui Maijishan Airport",
    "city": "Tianshui (Maiji)",
    "country": "CN"
  },
  {
    "code": "THR",
    "name": "Mehrabad International Airport",
    "city": "Tehran",
    "country": "IR"
  },
  {
    "code": "THS",
    "name": "Sukhothai Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "THU",
    "name": "Pituffik Space Base",
    "city": "Pituffik",
    "country": "GL"
  },
  {
    "code": "THZ",
    "name": "Tahoua Airport",
    "city": "Tahoua",
    "country": "NE"
  },
  {
    "code": "TIA",
    "name": "Tirana International Airport Mother Teresa",
    "city": "Rinas",
    "country": "AL"
  },
  {
    "code": "TID",
    "name": "Abdelhafid Boussouf Bou Chekif Airport",
    "city": "Tiaret",
    "country": "DZ"
  },
  {
    "code": "TIF",
    "name": "Ta’if Regional Airport",
    "city": "Ta’if",
    "country": "SA"
  },
  {
    "code": "TIH",
    "name": "Tikehau Airport",
    "city": "Tuherahera",
    "country": "PF"
  },
  {
    "code": "TIJ",
    "name": "General Abelardo L. Rodriguez International Airport",
    "city": "Tijuana",
    "country": "MX"
  },
  {
    "code": "TIK",
    "name": "Tinker Air Force Base",
    "city": "Oklahoma City",
    "country": "US"
  },
  {
    "code": "TIM",
    "name": "Mozes Kilangin Airport",
    "city": "Timika",
    "country": "ID"
  },
  {
    "code": "TIN",
    "name": "Tindouf Airport",
    "city": "Tindouf",
    "country": "DZ"
  },
  {
    "code": "TIQ",
    "name": "Tinian International Airport",
    "city": "Tinian Island",
    "country": "MP"
  },
  {
    "code": "TIR",
    "name": "Tirupati International Airport",
    "city": "Tirupati",
    "country": "IN"
  },
  {
    "code": "TIU",
    "name": "Timaru Airport",
    "city": null,
    "country": "NZ"
  },
  {
    "code": "TIV",
    "name": "Tivat Airport",
    "city": "Tivat",
    "country": "ME"
  },
  {
    "code": "TIW",
    "name": "Tacoma Narrows Airport",
    "city": "Tacoma",
    "country": "US"
  },
  {
    "code": "TIX",
    "name": "Space Coast Regional Airport",
    "city": "Titusville",
    "country": "US"
  },
  {
    "code": "TJA",
    "name": "Capitan Oriel Lea Plaza Airport",
    "city": "Tarija",
    "country": "BO"
  },
  {
    "code": "TJG",
    "name": "Warukin Airport",
    "city": "Tanta-Tabalong",
    "country": "ID"
  },
  {
    "code": "TJH",
    "name": "Konotori Tajima Airport",
    "city": "Toyooka",
    "country": "JP"
  },
  {
    "code": "TJI",
    "name": "Trujillo Airport",
    "city": "Trujillo",
    "country": "HN"
  },
  {
    "code": "TJK",
    "name": "Tokat Airport",
    "city": "Tokat",
    "country": "TR"
  },
  {
    "code": "TJM",
    "name": "Roshchino International Airport",
    "city": "Tyumen",
    "country": "RU"
  },
  {
    "code": "TJU",
    "name": "Kulob Airport",
    "city": "Kulyab",
    "country": "TJ"
  },
  {
    "code": "TKA",
    "name": "Talkeetna Airport",
    "city": "Talkeetna",
    "country": "US"
  },
  {
    "code": "TKC",
    "name": "Tiko Airport",
    "city": "Tiko",
    "country": "CM"
  },
  {
    "code": "TKD",
    "name": "Takoradi Airport",
    "city": "Sekondi-Takoradi",
    "country": "GH"
  },
  {
    "code": "TKF",
    "name": "Truckee Tahoe Airport",
    "city": "Truckee",
    "country": "US"
  },
  {
    "code": "TKG",
    "name": "Radin Inten II International Airport",
    "city": "Bandar Lampung",
    "country": "ID"
  },
  {
    "code": "TKH",
    "name": "Takhli Royal Thai Air Force Base",
    "city": "Takhli",
    "country": "TH"
  },
  {
    "code": "TKK",
    "name": "Chuuk International Airport",
    "city": "Weno Island",
    "country": "FM"
  },
  {
    "code": "TKN",
    "name": "Tokunoshima Airport",
    "city": "Amagi",
    "country": "JP"
  },
  {
    "code": "TKP",
    "name": "Takapoto Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "TKS",
    "name": "Tokushima Awaodori Airport / JMSDF Tokushima Air Base",
    "city": "Tokushima",
    "country": "JP"
  },
  {
    "code": "TKT",
    "name": "Tak Airport",
    "city": null,
    "country": "TH"
  },
  {
    "code": "TKU",
    "name": "Turku Airport",
    "city": "Turku",
    "country": "FI"
  },
  {
    "code": "TKX",
    "name": "Takaroa Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "TLC",
    "name": "Adolfo López Mateos International Airport",
    "city": "Toluca",
    "country": "MX"
  },
  {
    "code": "TLE",
    "name": "Toliara Airport",
    "city": "Toliara",
    "country": "MG"
  },
  {
    "code": "TLH",
    "name": "Tallahassee International Airport",
    "city": "Tallahassee",
    "country": "US"
  },
  {
    "code": "TLJ",
    "name": "Tatalina LRRS Airport",
    "city": "Takotna",
    "country": "US"
  },
  {
    "code": "TLL",
    "name": "Lennart Meri Tallinn Airport",
    "city": "Tallinn",
    "country": "EE"
  },
  {
    "code": "TLM",
    "name": "Zenata – Messali El Hadj Airport",
    "city": "Zenata",
    "country": "DZ"
  },
  {
    "code": "TLN",
    "name": "Toulon-Hyères Airport",
    "city": "Hyères, Var",
    "country": "FR"
  },
  {
    "code": "TLQ",
    "name": "Turpan Jiaohe Airport",
    "city": "Turpan",
    "country": "CN"
  },
  {
    "code": "TLS",
    "name": "Toulouse-Blagnac Airport",
    "city": "Toulouse/Blagnac",
    "country": "FR"
  },
  {
    "code": "TLV",
    "name": "Ben Gurion International Airport",
    "city": "Tel Aviv",
    "country": "IL"
  },
  {
    "code": "TLX",
    "name": "Panguilemo Airport",
    "city": "Talca",
    "country": "CL"
  },
  {
    "code": "TMB",
    "name": "Miami Executive Airport",
    "city": "Miami",
    "country": "US"
  },
  {
    "code": "TME",
    "name": "Gustavo Vargas Airport",
    "city": "Tame",
    "country": "CO"
  },
  {
    "code": "TMH",
    "name": "Tanah Merah Airport",
    "city": "Tanah Merah",
    "country": "ID"
  },
  {
    "code": "TMJ",
    "name": "Termez Airport",
    "city": "Termez",
    "country": "UZ"
  },
  {
    "code": "TML",
    "name": "Tamale International Airport",
    "city": "Tamale",
    "country": "GH"
  },
  {
    "code": "TMM",
    "name": "Toamasina Ambalamanasy Airport",
    "city": "Toamasina",
    "country": "MG"
  },
  {
    "code": "TMO",
    "name": "Tumeremo Airport",
    "city": null,
    "country": "VE"
  },
  {
    "code": "TMP",
    "name": "Tampere-Pirkkala Airport",
    "city": "Tampere / Pirkkala",
    "country": "FI"
  },
  {
    "code": "TMR",
    "name": "Aguenar – Hadj Bey Akhamok Airport",
    "city": "Tamanrasset",
    "country": "DZ"
  },
  {
    "code": "TMS",
    "name": "São Tomé International Airport",
    "city": "São Tomé",
    "country": "ST"
  },
  {
    "code": "TMT",
    "name": "Trombetas Airport",
    "city": "Oriximiná",
    "country": "BR"
  },
  {
    "code": "TMW",
    "name": "Tamworth Airport",
    "city": "Tamworth",
    "country": "AU"
  },
  {
    "code": "TMX",
    "name": "Timimoun Airport",
    "city": "Timimoun",
    "country": "DZ"
  },
  {
    "code": "TNA",
    "name": "Jinan Yaoqiang International Airport",
    "city": "Jinan (Licheng)",
    "country": "CN"
  },
  {
    "code": "TND",
    "name": "Alberto Delgado Airport",
    "city": "Trinidad",
    "country": "CU"
  },
  {
    "code": "TNE",
    "name": "New Tanegashima Airport",
    "city": "Tanegashima",
    "country": "JP"
  },
  {
    "code": "TNF",
    "name": "Toussus-le-Noble Airport",
    "city": "Toussus-le-Noble, Yvelines",
    "country": "FR"
  },
  {
    "code": "TNG",
    "name": "Tangier Ibn Battuta Airport",
    "city": "Tangier",
    "country": "MA"
  },
  {
    "code": "TNH",
    "name": "Tonghua Sanyuanpu Airport",
    "city": "Tonghua",
    "country": "CN"
  },
  {
    "code": "TNJ",
    "name": "Raja Haji Fisabilillah International Airport",
    "city": "Tanjung Pinang-Bintan Island",
    "country": "ID"
  },
  {
    "code": "TNN",
    "name": "Tainan International Airport / Tainan Air Base",
    "city": "Tainan (Rende)",
    "country": "TW"
  },
  {
    "code": "TNR",
    "name": "Ivato International Airport",
    "city": "Antananarivo",
    "country": "MG"
  },
  {
    "code": "TNW",
    "name": "Jumandy Airport",
    "city": "Ahuano",
    "country": "EC"
  },
  {
    "code": "TOD",
    "name": "Tioman Airport",
    "city": "Tioman Island",
    "country": "MY"
  },
  {
    "code": "TOE",
    "name": "Tozeur Nefta International Airport",
    "city": "Tozeur",
    "country": "TN"
  },
  {
    "code": "TOF",
    "name": "Tomsk Kamov Airport",
    "city": "Tomsk",
    "country": "RU"
  },
  {
    "code": "TOI",
    "name": "Troy Municipal Airport at N Kenneth Campbell Field",
    "city": "Troy",
    "country": "US"
  },
  {
    "code": "TOJ",
    "name": "Madrid–Torrejón Airport / Torrejón Air Base",
    "city": "Madrid",
    "country": "ES"
  },
  {
    "code": "TOL",
    "name": "Eugene F. Kranz Toledo Express Airport",
    "city": "Toledo",
    "country": "US"
  },
  {
    "code": "TOM",
    "name": "Tombouktou Airport",
    "city": "Timbuktu",
    "country": "ML"
  },
  {
    "code": "TOP",
    "name": "Philip Billard Municipal Airport",
    "city": "Topeka",
    "country": "US"
  },
  {
    "code": "TOQ",
    "name": "Barriles Airport",
    "city": "Tocopilla",
    "country": "CL"
  },
  {
    "code": "TOS",
    "name": "Tromsø Airport",
    "city": "Tromsø",
    "country": "NO"
  },
  {
    "code": "TOU",
    "name": "Touho Airport",
    "city": "Touho",
    "country": "NC"
  },
  {
    "code": "TOY",
    "name": "Toyama Kitokito Airport",
    "city": "Toyama",
    "country": "JP"
  },
  {
    "code": "TPA",
    "name": "Tampa International Airport",
    "city": "Tampa",
    "country": "US"
  },
  {
    "code": "TPC",
    "name": "Tarapoa Airport",
    "city": "Tarapoa",
    "country": "EC"
  },
  {
    "code": "TPE",
    "name": "Taiwan Taoyuan International Airport",
    "city": "Taoyuan",
    "country": "TW"
  },
  {
    "code": "TPH",
    "name": "Tonopah Airport",
    "city": "Tonopah",
    "country": "US"
  },
  {
    "code": "TPJ",
    "name": "Taplejung Airport",
    "city": "Taplejung",
    "country": "NP"
  },
  {
    "code": "TPL",
    "name": "Draughon Miller Central Texas Regional Airport",
    "city": "Temple",
    "country": "US"
  },
  {
    "code": "TPP",
    "name": "Cadete FAP Guillermo Del Castillo Paredes Airport",
    "city": "Tarapoto",
    "country": "PE"
  },
  {
    "code": "TPQ",
    "name": "Amado Nervo National Airport",
    "city": "Tepic",
    "country": "MX"
  },
  {
    "code": "TPS",
    "name": "Vincenzo Florio Airport Trapani-Birgi",
    "city": "Trapani (TP)",
    "country": "IT"
  },
  {
    "code": "TQD",
    "name": "Al Taqaddum Air Base",
    "city": "Al Habbaniyah",
    "country": "IQ"
  },
  {
    "code": "TQO",
    "name": "Felipe Carrillo Puerto International Airport Tulum",
    "city": "Tulum",
    "country": "MX"
  },
  {
    "code": "TQS",
    "name": "Captain Ernesto Esguerra Cubides Air Base",
    "city": "Tres Esquinas",
    "country": "CO"
  },
  {
    "code": "TRA",
    "name": "Tarama Airport",
    "city": "Tarama",
    "country": "JP"
  },
  {
    "code": "TRC",
    "name": "Francisco Sarabia Tinoco International Airport",
    "city": "Torreón",
    "country": "MX"
  },
  {
    "code": "TRD",
    "name": "Trondheim Airport, Værnes",
    "city": "Trondheim",
    "country": "NO"
  },
  {
    "code": "TRE",
    "name": "Tiree Airport",
    "city": "Balemartine, Argyll and Bute",
    "country": "GB"
  },
  {
    "code": "TRF",
    "name": "Sandefjord Airport, Torp",
    "city": "Sandefjord(Torp)",
    "country": "NO"
  },
  {
    "code": "TRG",
    "name": "Tauranga Airport",
    "city": "Tauranga",
    "country": "NZ"
  },
  {
    "code": "TRI",
    "name": "Tri-Cities Regional TN/VA Airport",
    "city": "Blountville",
    "country": "US"
  },
  {
    "code": "TRK",
    "name": "Juwata International Airport / Suharnoko Harbani AFB",
    "city": "Tarakan",
    "country": "ID"
  },
  {
    "code": "TRM",
    "name": "Jacqueline Cochran Regional Airport",
    "city": "Palm Springs",
    "country": "US"
  },
  {
    "code": "TRN",
    "name": "Turin Airport",
    "city": "Caselle Torinese (TO)",
    "country": "IT"
  },
  {
    "code": "TRO",
    "name": "Taree Airport",
    "city": "Taree",
    "country": "AU"
  },
  {
    "code": "TRQ",
    "name": "Tarauacá Airport",
    "city": "Tarauacá",
    "country": "BR"
  },
  {
    "code": "TRR",
    "name": "China Bay Airport",
    "city": "Trincomalee",
    "country": "LK"
  },
  {
    "code": "TRS",
    "name": "Trieste Airport",
    "city": "Ronchi dei Legionari/Trieste",
    "country": "IT"
  },
  {
    "code": "TRT",
    "name": "Toraja Airport",
    "city": "Toraja",
    "country": "ID"
  },
  {
    "code": "TRU",
    "name": "Capitán FAP Carlos Martínez de Pinillos International Airport",
    "city": "Trujillo",
    "country": "PE"
  },
  {
    "code": "TRV",
    "name": "Thiruvananthapuram International Airport",
    "city": "Thiruvananthapuram",
    "country": "IN"
  },
  {
    "code": "TRW",
    "name": "Bonriki International Airport",
    "city": "South Tarawa",
    "country": "KI"
  },
  {
    "code": "TRZ",
    "name": "Tiruchirappalli International Airport",
    "city": "Tiruchirappalli",
    "country": "IN"
  },
  {
    "code": "TSA",
    "name": "Taipei Songshan International Airport",
    "city": "Taipei (Songshan)",
    "country": "TW"
  },
  {
    "code": "TSB",
    "name": "Tsumeb Airport",
    "city": "Tsumeb",
    "country": "NA"
  },
  {
    "code": "TSF",
    "name": "Treviso Airport",
    "city": "Treviso (TV)",
    "country": "IT"
  },
  {
    "code": "TSJ",
    "name": "Tsushima Airport",
    "city": "Tsushima",
    "country": "JP"
  },
  {
    "code": "TSM",
    "name": "Taos Regional Airport",
    "city": "Taos",
    "country": "US"
  },
  {
    "code": "TSN",
    "name": "Tianjin Binhai International Airport",
    "city": "Tianjin",
    "country": "CN"
  },
  {
    "code": "TSR",
    "name": "Timișoara Traian Vuia International Airport",
    "city": "Timişoara",
    "country": "RO"
  },
  {
    "code": "TST",
    "name": "Trang Airport",
    "city": "Trang",
    "country": "TH"
  },
  {
    "code": "TSV",
    "name": "Townsville Airport / RAAF Base Townsville",
    "city": "Townsville",
    "country": "AU"
  },
  {
    "code": "TTA",
    "name": "Tan Tan Airport",
    "city": "Tan Tan",
    "country": "MA"
  },
  {
    "code": "TTC",
    "name": "Las Breas Airport",
    "city": "Taltal",
    "country": "CL"
  },
  {
    "code": "TTD",
    "name": "Portland Troutdale Airport",
    "city": "Portland",
    "country": "US"
  },
  {
    "code": "TTE",
    "name": "Sultan Babullah Airport",
    "city": "Ternate",
    "country": "ID"
  },
  {
    "code": "TTG",
    "name": "General Enrique Mosconi Airport",
    "city": "Tartagal",
    "country": "AR"
  },
  {
    "code": "TTH",
    "name": "Thumrait Air Base",
    "city": "Thumrait",
    "country": "OM"
  },
  {
    "code": "TTJ",
    "name": "Tottori Sand Dunes Conan Airport",
    "city": "Tottori",
    "country": "JP"
  },
  {
    "code": "TTN",
    "name": "Trenton Mercer Airport",
    "city": "Ewing Township",
    "country": "US"
  },
  {
    "code": "TTT",
    "name": "Taitung Airport",
    "city": "Taitung City",
    "country": "TW"
  },
  {
    "code": "TTU",
    "name": "Sania Ramel Airport",
    "city": "Tétouan",
    "country": "MA"
  },
  {
    "code": "TUA",
    "name": "Lieutenant Colonel Luis A. Mantilla International Airport",
    "city": "Tulcán",
    "country": "EC"
  },
  {
    "code": "TUB",
    "name": "Tubuai Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "TUC",
    "name": "Teniente Benjamin Matienzo Airport",
    "city": "San Miguel de Tucumán",
    "country": "AR"
  },
  {
    "code": "TUD",
    "name": "Tambacounda Airport",
    "city": "Tambacounda",
    "country": "SN"
  },
  {
    "code": "TUF",
    "name": "Tours Val de Loire Airport",
    "city": "Tours, Indre-et-Loire",
    "country": "FR"
  },
  {
    "code": "TUG",
    "name": "Tuguegarao Airport",
    "city": "Tuguegarao City",
    "country": "PH"
  },
  {
    "code": "TUI",
    "name": "Turaif Domestic Airport",
    "city": "Turaif",
    "country": "SA"
  },
  {
    "code": "TUK",
    "name": "Turbat International Airport",
    "city": "Turbat",
    "country": "PK"
  },
  {
    "code": "TUL",
    "name": "Tulsa International Airport",
    "city": "Tulsa",
    "country": "US"
  },
  {
    "code": "TUM",
    "name": "Tumut Aerodrome",
    "city": "Tumut",
    "country": "AU"
  },
  {
    "code": "TUN",
    "name": "Tunis Carthage International Airport",
    "city": "Tunis",
    "country": "TN"
  },
  {
    "code": "TUO",
    "name": "Taupo Airport",
    "city": "Taupo",
    "country": "NZ"
  },
  {
    "code": "TUP",
    "name": "Tupelo Regional Airport",
    "city": "Tupelo",
    "country": "US"
  },
  {
    "code": "TUR",
    "name": "Tucuruí Airport",
    "city": "Tucuruí",
    "country": "BR"
  },
  {
    "code": "TUS",
    "name": "Tucson International Airport",
    "city": "Tucson",
    "country": "US"
  },
  {
    "code": "TUU",
    "name": "Tabuk Airport",
    "city": "Tabuk",
    "country": "SA"
  },
  {
    "code": "TUV",
    "name": "Tucupita Airport",
    "city": "Tucupita",
    "country": "VE"
  },
  {
    "code": "TVC",
    "name": "Cherry Capital Airport",
    "city": "Traverse City",
    "country": "US"
  },
  {
    "code": "TVF",
    "name": "Thief River Falls Regional Airport",
    "city": "Thief River Falls",
    "country": "US"
  },
  {
    "code": "TVL",
    "name": "Lake Tahoe Airport",
    "city": "South Lake Tahoe",
    "country": "US"
  },
  {
    "code": "TVY",
    "name": "Dawei Airport",
    "city": "Dawei",
    "country": "MM"
  },
  {
    "code": "TWF",
    "name": "Joslin Field Magic Valley Regional Airport",
    "city": "Twin Falls",
    "country": "US"
  },
  {
    "code": "TWT",
    "name": "Sanga Sanga Airport",
    "city": "Bongao",
    "country": "PH"
  },
  {
    "code": "TWU",
    "name": "Tawau Airport",
    "city": "Tawau",
    "country": "MY"
  },
  {
    "code": "TWZ",
    "name": "Pukaki Airport",
    "city": "Twitzel",
    "country": "NZ"
  },
  {
    "code": "TXC",
    "name": "Orsha Airport - Balbasovo Air Base",
    "city": "Orsha",
    "country": "BY"
  },
  {
    "code": "TXE",
    "name": "Rembele Airport",
    "city": "Takengon",
    "country": "ID"
  },
  {
    "code": "TXK",
    "name": "Texarkana Regional Airport (Webb Field)",
    "city": "Texarkana",
    "country": "US"
  },
  {
    "code": "TXN",
    "name": "Tunxi International Airport",
    "city": "Huangshan",
    "country": "CN"
  },
  {
    "code": "TYB",
    "name": "Tibooburra Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "TYF",
    "name": "Torsby Airport",
    "city": "Torsby",
    "country": "SE"
  },
  {
    "code": "TYL",
    "name": "Captain Victor Montes Arias International Airport",
    "city": "Talara",
    "country": "PE"
  },
  {
    "code": "TYM",
    "name": "Staniel Cay Airport",
    "city": "Staniel Cay",
    "country": "BS"
  },
  {
    "code": "TYN",
    "name": "Taiyuan Wusu International Airport",
    "city": "Taiyuan",
    "country": "CN"
  },
  {
    "code": "TYR",
    "name": "Tyler Pounds Regional Airport",
    "city": "Tyler",
    "country": "US"
  },
  {
    "code": "TYS",
    "name": "McGhee Tyson Airport",
    "city": "Knoxville/Maryville",
    "country": "US"
  },
  {
    "code": "TZA",
    "name": "Sir Barry Bowen Municipal Airport",
    "city": "Belize City",
    "country": "BZ"
  },
  {
    "code": "TZL",
    "name": "Tuzla International Airport",
    "city": "Dubrave Gornje",
    "country": "BA"
  },
  {
    "code": "TZN",
    "name": "Congo Town Airport",
    "city": "Andros",
    "country": "BS"
  },
  {
    "code": "TZX",
    "name": "Trabzon International Airport",
    "city": "Trabzon",
    "country": "TR"
  },
  {
    "code": "UAB",
    "name": "İncirlik Air Base",
    "city": "Sarıçam",
    "country": "TR"
  },
  {
    "code": "UAI",
    "name": "Suai Airport",
    "city": "Suai",
    "country": "TL"
  },
  {
    "code": "UAK",
    "name": "Narsarsuaq International Airport",
    "city": "Narsarsuaq",
    "country": "GL"
  },
  {
    "code": "UAM",
    "name": "Andersen Air Force Base",
    "city": "Yigo",
    "country": "GU"
  },
  {
    "code": "UAQ",
    "name": "Domingo Faustino Sarmiento Airport",
    "city": "San Juan",
    "country": "AR"
  },
  {
    "code": "UAR",
    "name": "Bouarfa Airport",
    "city": "Bouarfa",
    "country": "MA"
  },
  {
    "code": "UBA",
    "name": "Mário de Almeida Franco Airport",
    "city": "Uberaba",
    "country": "BR"
  },
  {
    "code": "UBJ",
    "name": "Yamaguchi Ube Airport",
    "city": "Ube",
    "country": "JP"
  },
  {
    "code": "UBN",
    "name": "Ulaanbaatar Chinggis Khaan International Airport",
    "city": "Ulaanbaatar (Sergelen)",
    "country": "MN"
  },
  {
    "code": "UBP",
    "name": "Ubon Ratchathani Airport",
    "city": "Ubon Ratchathani",
    "country": "TH"
  },
  {
    "code": "UCB",
    "name": "Ulanqab Jining Airport",
    "city": "Ulanqab",
    "country": "CN"
  },
  {
    "code": "UCT",
    "name": "Ukhta Airport",
    "city": "Ukhta",
    "country": "RU"
  },
  {
    "code": "UDE",
    "name": "Volkel Air Base",
    "city": "Uden",
    "country": "NL"
  },
  {
    "code": "UDI",
    "name": "Ten. Cel. Aviador César Bombonato Airport",
    "city": "Uberlândia",
    "country": "BR"
  },
  {
    "code": "UDJ",
    "name": "Uzhhorod International Airport",
    "city": "Uzhhorod",
    "country": "UA"
  },
  {
    "code": "UDR",
    "name": "Maharana Pratap Airport",
    "city": "Udaipur",
    "country": "IN"
  },
  {
    "code": "UEL",
    "name": "Quelimane Airport",
    "city": "Quelimane",
    "country": "MZ"
  },
  {
    "code": "UEO",
    "name": "Kumejima Airport",
    "city": "Kumejima",
    "country": "JP"
  },
  {
    "code": "UET",
    "name": "Quetta International Airport",
    "city": "Quetta",
    "country": "PK"
  },
  {
    "code": "UFA",
    "name": "Ufa International Airport",
    "city": "Ufa",
    "country": "RU"
  },
  {
    "code": "UGA",
    "name": "Bulgan Airport",
    "city": "Bulgan",
    "country": "MN"
  },
  {
    "code": "UGC",
    "name": "Urgench International Airport",
    "city": "Urgench",
    "country": "UZ"
  },
  {
    "code": "UGO",
    "name": "Uige Airport",
    "city": "Uige",
    "country": "AO"
  },
  {
    "code": "UGU",
    "name": "Bilorai Airport",
    "city": "Bilogai",
    "country": "ID"
  },
  {
    "code": "UHE",
    "name": "Kunovice Airport",
    "city": "Uherské Hradiště",
    "country": "CZ"
  },
  {
    "code": "UIB",
    "name": "El Caraño Airport",
    "city": "Quibdó",
    "country": "CO"
  },
  {
    "code": "UIH",
    "name": "Phu Cat Airport",
    "city": "Quy Nohn",
    "country": "VN"
  },
  {
    "code": "UIN",
    "name": "Quincy Regional Airport Baldwin Field",
    "city": "Quincy",
    "country": "US"
  },
  {
    "code": "UIO",
    "name": "Mariscal Sucre International Airport",
    "city": "Quito",
    "country": "EC"
  },
  {
    "code": "UIP",
    "name": "Quimper-Cornouaille Airport",
    "city": "Quimper/Pluguffan",
    "country": "FR"
  },
  {
    "code": "UKB",
    "name": "Kobe Airport",
    "city": "Kobe",
    "country": "JP"
  },
  {
    "code": "UKI",
    "name": "Ukiah Municipal Airport",
    "city": "Ukiah",
    "country": "US"
  },
  {
    "code": "UKK",
    "name": "Oskemen International Airport",
    "city": "Ust-Kamenogorsk (Oskemen)",
    "country": "KZ"
  },
  {
    "code": "UKS",
    "name": "Sevastopol International Airport / Belbek Air Base",
    "city": "Sevastopol",
    "country": "UA"
  },
  {
    "code": "UKX",
    "name": "Ust-Kut Airport",
    "city": "Ust-Kut",
    "country": "RU"
  },
  {
    "code": "ULA",
    "name": "Capitan D Daniel Vazquez Airport",
    "city": "San Julian",
    "country": "AR"
  },
  {
    "code": "ULD",
    "name": "Prince Mangosuthu Buthelezi Airport",
    "city": "Ulundi",
    "country": "ZA"
  },
  {
    "code": "ULG",
    "name": "Ölgii Mongolei International Airport",
    "city": "Ölgii",
    "country": "MN"
  },
  {
    "code": "ULH",
    "name": "Majeed Bin Abdulaziz Airport",
    "city": "Al Ula",
    "country": "SA"
  },
  {
    "code": "ULK",
    "name": "Lensk Airport",
    "city": "Lensk",
    "country": "RU"
  },
  {
    "code": "ULN",
    "name": "Buyant-Ukhaa International Airport",
    "city": "Ulaanbaatar",
    "country": "MN"
  },
  {
    "code": "ULO",
    "name": "Ulaangom Airport",
    "city": "Ulaangom",
    "country": "MN"
  },
  {
    "code": "ULP",
    "name": "Quilpie Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "ULQ",
    "name": "Heriberto Gíl Martínez Airport",
    "city": "Tuluá",
    "country": "CO"
  },
  {
    "code": "ULU",
    "name": "Gulu Airport",
    "city": "Gulu",
    "country": "UG"
  },
  {
    "code": "ULV",
    "name": "Ulyanovsk Baratayevka Airport",
    "city": "Ulyanovsk",
    "country": "RU"
  },
  {
    "code": "ULY",
    "name": "Ulyanovsk Vostochny Airport",
    "city": "Cherdakly",
    "country": "RU"
  },
  {
    "code": "UMB",
    "name": "Kalumbila Airport",
    "city": "Kalumbila",
    "country": "ZM"
  },
  {
    "code": "UME",
    "name": "Umeå Airport",
    "city": "Umeå",
    "country": "SE"
  },
  {
    "code": "UND",
    "name": "Kunduz Airport",
    "city": "Kunduz",
    "country": "AF"
  },
  {
    "code": "UNI",
    "name": "Union Island International Airport",
    "city": "Union Island",
    "country": "VC"
  },
  {
    "code": "UNK",
    "name": "Unalakleet Airport",
    "city": "Unalakleet",
    "country": "US"
  },
  {
    "code": "UNN",
    "name": "Ranong Airport",
    "city": "Ranong",
    "country": "TH"
  },
  {
    "code": "UOX",
    "name": "University Oxford Airport",
    "city": "Oxford",
    "country": "US"
  },
  {
    "code": "UPB",
    "name": "Playa Baracoa Airport",
    "city": "Havana",
    "country": "CU"
  },
  {
    "code": "UPG",
    "name": "Sultan Hasanuddin International Airport",
    "city": "Makassar",
    "country": "ID"
  },
  {
    "code": "UPL",
    "name": "Upala Airport",
    "city": "Upala",
    "country": "CR"
  },
  {
    "code": "UPN",
    "name": "Uruapan - Licenciado y General Ignacio Lopez Rayon International Airport",
    "city": "Uruapan",
    "country": "MX"
  },
  {
    "code": "URA",
    "name": "Manshuk Mametova International Airport",
    "city": "Uralsk",
    "country": "KZ"
  },
  {
    "code": "URC",
    "name": "Ürümqi Tianshan International Airport",
    "city": "Ürümqi",
    "country": "CN"
  },
  {
    "code": "URE",
    "name": "Kuressaare Airport",
    "city": "Kuressaare",
    "country": "EE"
  },
  {
    "code": "URG",
    "name": "Rubem Berta Airport",
    "city": "Uruguaiana",
    "country": "BR"
  },
  {
    "code": "URJ",
    "name": "Uray Airport",
    "city": "Uray",
    "country": "RU"
  },
  {
    "code": "URO",
    "name": "Rouen Vallée de Seine Airport",
    "city": "Boos",
    "country": "FR"
  },
  {
    "code": "URS",
    "name": "Kursk East Airport",
    "city": "Kursk",
    "country": "RU"
  },
  {
    "code": "URT",
    "name": "Surat Thani Airport",
    "city": "Surat Thani",
    "country": "TH"
  },
  {
    "code": "URY",
    "name": "Gurayat Domestic Airport",
    "city": "Gurayat",
    "country": "SA"
  },
  {
    "code": "USA",
    "name": "Concord-Padgett Regional Airport",
    "city": "Concord",
    "country": "US"
  },
  {
    "code": "USH",
    "name": "Ushuaia - Malvinas Argentinas International Airport",
    "city": "Ushuaia",
    "country": "AR"
  },
  {
    "code": "USK",
    "name": "Usinsk Airport",
    "city": "Usinsk",
    "country": "RU"
  },
  {
    "code": "USM",
    "name": "Samui International Airport",
    "city": "Na Thon (Ko Samui Island)",
    "country": "TH"
  },
  {
    "code": "USN",
    "name": "Ulsan Airport",
    "city": "Ulsan",
    "country": "KR"
  },
  {
    "code": "USQ",
    "name": "Uşak Airport",
    "city": "Uşak",
    "country": "TR"
  },
  {
    "code": "USR",
    "name": "Ust-Nera Airport",
    "city": "Ust-Nera",
    "country": "RU"
  },
  {
    "code": "UST",
    "name": "Northeast Florida Regional Airport",
    "city": "St Augustine",
    "country": "US"
  },
  {
    "code": "USU",
    "name": "Francisco B. Reyes (Busuanga) Airport",
    "city": "Coron",
    "country": "PH"
  },
  {
    "code": "UTH",
    "name": "Udon Thani International Airport",
    "city": "Udon Thani",
    "country": "TH"
  },
  {
    "code": "UTI",
    "name": "Utti Air Base",
    "city": "Utti / Valkeala",
    "country": "FI"
  },
  {
    "code": "UTN",
    "name": "Upington International Airport",
    "city": "Upington",
    "country": "ZA"
  },
  {
    "code": "UTO",
    "name": "Indian Mountain LRRS Airport",
    "city": "Utopia Creek",
    "country": "US"
  },
  {
    "code": "UTP",
    "name": "U-Tapao–Rayong–Pattaya International Airport",
    "city": "Rayong",
    "country": "TH"
  },
  {
    "code": "UTS",
    "name": "Ust-Tsylma Airport",
    "city": "Ust-Tsylma",
    "country": "RU"
  },
  {
    "code": "UTT",
    "name": "K. D. Matanzima Airport",
    "city": "Mthatha",
    "country": "ZA"
  },
  {
    "code": "UTW",
    "name": "Queenstown Airport",
    "city": "Queenstown",
    "country": "ZA"
  },
  {
    "code": "UUA",
    "name": "Bugulma Airport",
    "city": "Bugulma",
    "country": "RU"
  },
  {
    "code": "UUD",
    "name": "Baikal International Airport",
    "city": "Ulan Ude",
    "country": "RU"
  },
  {
    "code": "UUN",
    "name": "Baruun Urt Airport",
    "city": null,
    "country": "MN"
  },
  {
    "code": "UUS",
    "name": "Yuzhno-Sakhalinsk Airport",
    "city": "Yuzhno-Sakhalinsk",
    "country": "RU"
  },
  {
    "code": "UVE",
    "name": "Ouvéa Airport",
    "city": "Ouvéa",
    "country": "NC"
  },
  {
    "code": "UVF",
    "name": "Hewanorra International Airport",
    "city": "Vieux Fort",
    "country": "LC"
  },
  {
    "code": "UYL",
    "name": "Nyala Airport",
    "city": "Nyala",
    "country": "SD"
  },
  {
    "code": "UZC",
    "name": "Ponikve Airport",
    "city": "Stapari",
    "country": "RS"
  },
  {
    "code": "UZU",
    "name": "Curuzu Cuatia Airport",
    "city": "Curuzu Cuatia",
    "country": "AR"
  },
  {
    "code": "VAA",
    "name": "Vaasa Airport",
    "city": "Vaasa",
    "country": "FI"
  },
  {
    "code": "VAD",
    "name": "Moody Air Force Base",
    "city": "Valdosta",
    "country": "US"
  },
  {
    "code": "VAF",
    "name": "Valence-Chabeuil Airport",
    "city": "Chabeuil, Drôme",
    "country": "FR"
  },
  {
    "code": "VAG",
    "name": "Major Brigadeiro Trompowsky Airport",
    "city": "Varginha",
    "country": "BR"
  },
  {
    "code": "VAI",
    "name": "Vanimo Airport",
    "city": "Vanimo",
    "country": "PG"
  },
  {
    "code": "VAM",
    "name": "Villa International Airport Maamigili",
    "city": "Maamigili",
    "country": "MV"
  },
  {
    "code": "VAN",
    "name": "Van Ferit Melen Airport",
    "city": "Van",
    "country": "TR"
  },
  {
    "code": "VAQ",
    "name": "Vanavara Airport",
    "city": "Vanavara",
    "country": "RU"
  },
  {
    "code": "VAR",
    "name": "Varna Airport",
    "city": "Varna",
    "country": "BG"
  },
  {
    "code": "VAV",
    "name": "Vava'u International Airport",
    "city": "Vava'u Island",
    "country": "TO"
  },
  {
    "code": "VAW",
    "name": "Vardø Airport, Svartnes",
    "city": "Vardø",
    "country": "NO"
  },
  {
    "code": "VBG",
    "name": "Vandenberg Space Force Base",
    "city": "Lompoc",
    "country": "US"
  },
  {
    "code": "VBS",
    "name": "Brescia Gabriele d'Annunzio Airport",
    "city": "Montichiari (BS)",
    "country": "IT"
  },
  {
    "code": "VBY",
    "name": "Visby Airport",
    "city": "Visby",
    "country": "SE"
  },
  {
    "code": "VCA",
    "name": "Can Tho International Airport",
    "city": "Can Tho",
    "country": "VN"
  },
  {
    "code": "VCE",
    "name": "Venice Marco Polo Airport",
    "city": "Venezia (VE)",
    "country": "IT"
  },
  {
    "code": "VCP",
    "name": "Viracopos International Airport",
    "city": "Campinas",
    "country": "BR"
  },
  {
    "code": "VCS",
    "name": "Con Dao Airport",
    "city": "Con Dao",
    "country": "VN"
  },
  {
    "code": "VCT",
    "name": "Victoria Regional Airport",
    "city": "Victoria",
    "country": "US"
  },
  {
    "code": "VDC",
    "name": "Glauber de Andrade Rocha Airport",
    "city": "Vitória da Conquista",
    "country": "BR"
  },
  {
    "code": "VDE",
    "name": "El Hierro Airport",
    "city": "El Hierro Island",
    "country": "ES"
  },
  {
    "code": "VDH",
    "name": "Dong Hoi Airport",
    "city": "Dong Hoi",
    "country": "VN"
  },
  {
    "code": "VDM",
    "name": "Gobernador Castello Airport",
    "city": "Viedma / Carmen de Patagones",
    "country": "AR"
  },
  {
    "code": "VDO",
    "name": "Van Don International Airport",
    "city": "Van Don",
    "country": "VN"
  },
  {
    "code": "VDP",
    "name": "Valle de La Pascua Airport",
    "city": null,
    "country": "VE"
  },
  {
    "code": "VDR",
    "name": "Villa Dolores Airport",
    "city": "Villa Dolores",
    "country": "AR"
  },
  {
    "code": "VDS",
    "name": "Vadsø Airport",
    "city": "Vadsø",
    "country": "NO"
  },
  {
    "code": "VDZ",
    "name": "Valdez Pioneer Field",
    "city": "Valdez",
    "country": "US"
  },
  {
    "code": "VEL",
    "name": "Vernal Regional Airport",
    "city": "Vernal",
    "country": "US"
  },
  {
    "code": "VEO",
    "name": "Severo-Yeniseysk Airport",
    "city": "Severo-Yeniseysk",
    "country": "RU"
  },
  {
    "code": "VER",
    "name": "General Heriberto Jara International Airport",
    "city": "Veracruz",
    "country": "MX"
  },
  {
    "code": "VEY",
    "name": "Vestmannaeyjar Airport",
    "city": "Vestmannaeyjar",
    "country": "IS"
  },
  {
    "code": "VFA",
    "name": "Victoria Falls International Airport",
    "city": "Victoria Falls",
    "country": "ZW"
  },
  {
    "code": "VGA",
    "name": "Vijayawada International Airport",
    "city": "Vijayawada",
    "country": "IN"
  },
  {
    "code": "VGD",
    "name": "Vologda Airport",
    "city": "Vologda",
    "country": "RU"
  },
  {
    "code": "VGO",
    "name": "Vigo Airport",
    "city": "Vigo",
    "country": "ES"
  },
  {
    "code": "VGT",
    "name": "North Las Vegas Airport",
    "city": "Las Vegas",
    "country": "US"
  },
  {
    "code": "VHC",
    "name": "Saurimo Airport",
    "city": "Saurimo",
    "country": "AO"
  },
  {
    "code": "VHM",
    "name": "Vilhelmina South Lapland Airport",
    "city": "Vilhelmina",
    "country": "SE"
  },
  {
    "code": "VHY",
    "name": "Vichy-Charmeil Airport",
    "city": "Charmeil, Allier",
    "country": "FR"
  },
  {
    "code": "VIE",
    "name": "Vienna International Airport",
    "city": "Vienna",
    "country": "AT"
  },
  {
    "code": "VIG",
    "name": "Juan Pablo Pérez Alfonso Airport",
    "city": "El Vigía",
    "country": "VE"
  },
  {
    "code": "VII",
    "name": "Vinh Airport",
    "city": "Vinh",
    "country": "VN"
  },
  {
    "code": "VIJ",
    "name": "Virgin Gorda Airport",
    "city": "Spanish Town",
    "country": "VG"
  },
  {
    "code": "VIL",
    "name": "Dakhla Airport",
    "city": "Dakhla",
    "country": "EH"
  },
  {
    "code": "VIN",
    "name": "Vinnytsia/Gavyryshivka International Airport",
    "city": "Vinnitsa",
    "country": "UA"
  },
  {
    "code": "VIP",
    "name": "Payerne Air Base",
    "city": "Payerne",
    "country": "CH"
  },
  {
    "code": "VIR",
    "name": "Virginia Airport",
    "city": "Durban",
    "country": "ZA"
  },
  {
    "code": "VIS",
    "name": "Visalia Municipal Airport",
    "city": "Visalia",
    "country": "US"
  },
  {
    "code": "VIT",
    "name": "Vitoria Airport",
    "city": "Alava",
    "country": "ES"
  },
  {
    "code": "VIX",
    "name": "Eurico de Aguiar Salles Airport",
    "city": "Vitória",
    "country": "BR"
  },
  {
    "code": "VIY",
    "name": "Vélizy-Villacoublay Air Base",
    "city": "Vélizy-Villacoublay, Yvelines",
    "country": "FR"
  },
  {
    "code": "VKG",
    "name": "Rach Gia Airport",
    "city": "Rach Gia",
    "country": "VN"
  },
  {
    "code": "VKO",
    "name": "Vnukovo International Airport",
    "city": "Moscow",
    "country": "RU"
  },
  {
    "code": "VKT",
    "name": "Vorkuta Airport",
    "city": "Vorkuta",
    "country": "RU"
  },
  {
    "code": "VKV",
    "name": "Vaskovo Airport",
    "city": "Arkhangelsk",
    "country": "RU"
  },
  {
    "code": "VLC",
    "name": "Valencia Airport",
    "city": "Valencia",
    "country": "ES"
  },
  {
    "code": "VLD",
    "name": "Valdosta Regional Airport",
    "city": "Valdosta",
    "country": "US"
  },
  {
    "code": "VLG",
    "name": "Villa Gesell Airport",
    "city": "Villa Gesell",
    "country": "AR"
  },
  {
    "code": "VLI",
    "name": "Bauerfield International Airport",
    "city": "Port Vila",
    "country": "VU"
  },
  {
    "code": "VLL",
    "name": "Valladolid Airport",
    "city": "Valladolid",
    "country": "ES"
  },
  {
    "code": "VLM",
    "name": "Teniente Coronel Rafael Pabón Airport",
    "city": "Villamontes",
    "country": "BO"
  },
  {
    "code": "VLN",
    "name": "Arturo Michelena International Airport",
    "city": "Valencia",
    "country": "VE"
  },
  {
    "code": "VLR",
    "name": "Vallenar Airport",
    "city": "Vallenar",
    "country": "CL"
  },
  {
    "code": "VLV",
    "name": "Dr. Antonio Nicolás Briceño Airport",
    "city": "Valera",
    "country": "VE"
  },
  {
    "code": "VLY",
    "name": "Anglesey Airport",
    "city": "Angelsey",
    "country": "GB"
  },
  {
    "code": "VME",
    "name": "Villa Reynolds Airport",
    "city": "Villa Mercedes",
    "country": "AR"
  },
  {
    "code": "VMI",
    "name": "Aeropuerto Nacional Doctor Juan Plate",
    "city": "Puerto Vallemi",
    "country": "PY"
  },
  {
    "code": "VMU",
    "name": "Baimuru Airport",
    "city": "Baimuru",
    "country": "PG"
  },
  {
    "code": "VNE",
    "name": "Vannes-Meucon Airport",
    "city": "Vannes/Meucon",
    "country": "FR"
  },
  {
    "code": "VNO",
    "name": "Vilnius International Airport",
    "city": "Vilnius",
    "country": "LT"
  },
  {
    "code": "VNS",
    "name": "Lal Bahadur Shastri International Airport",
    "city": "Varanasi",
    "country": "IN"
  },
  {
    "code": "VNX",
    "name": "Vilankulo Airport",
    "city": "Vilanculo",
    "country": "MZ"
  },
  {
    "code": "VNY",
    "name": "Van Nuys Airport",
    "city": "Van Nuys",
    "country": "US"
  },
  {
    "code": "VOD",
    "name": "Vodochody Airport",
    "city": "Vodochody",
    "country": "CZ"
  },
  {
    "code": "VOG",
    "name": "Volgograd International Airport",
    "city": "Volgograd",
    "country": "RU"
  },
  {
    "code": "VOH",
    "name": "Vohemar Airport",
    "city": "Vohemar",
    "country": "MG"
  },
  {
    "code": "VOK",
    "name": "Volk Field",
    "city": "Camp Douglas",
    "country": "US"
  },
  {
    "code": "VOL",
    "name": "Nea Anchialos National Airport",
    "city": "Nea Anchialos",
    "country": "GR"
  },
  {
    "code": "VOZ",
    "name": "Voronezh International Airport",
    "city": "Voronezh",
    "country": "RU"
  },
  {
    "code": "VPE",
    "name": "Ngjiva Pereira Airport",
    "city": "Ngiva",
    "country": "AO"
  },
  {
    "code": "VPS",
    "name": "Destin-Fort Walton Beach Airport",
    "city": "Valparaiso",
    "country": "US"
  },
  {
    "code": "VPY",
    "name": "Chimoio Airport",
    "city": "Chimoio",
    "country": "MZ"
  },
  {
    "code": "VPZ",
    "name": "Porter County Municipal Airport",
    "city": "Valparaiso",
    "country": "US"
  },
  {
    "code": "VQQ",
    "name": "Cecil Airport",
    "city": "Jacksonville",
    "country": "US"
  },
  {
    "code": "VQS",
    "name": "Antonio Rivera Rodriguez Airport",
    "city": "Vieques",
    "country": "PR"
  },
  {
    "code": "VRA",
    "name": "Juan Gualberto Gomez International Airport",
    "city": "Matanzas",
    "country": "CU"
  },
  {
    "code": "VRB",
    "name": "Vero Beach Regional Airport",
    "city": "Vero Beach",
    "country": "US"
  },
  {
    "code": "VRC",
    "name": "Virac Airport",
    "city": "Virac",
    "country": "PH"
  },
  {
    "code": "VRE",
    "name": "Vredendal Airport",
    "city": "Vredendal",
    "country": "ZA"
  },
  {
    "code": "VRK",
    "name": "Varkaus Airport",
    "city": "Varkaus / Joroinen",
    "country": "FI"
  },
  {
    "code": "VRL",
    "name": "Vila Real Airport",
    "city": "Vila Real",
    "country": "PT"
  },
  {
    "code": "VRN",
    "name": "Verona Villafranca Valerio Catullo Airport",
    "city": "Caselle (VR)",
    "country": "IT"
  },
  {
    "code": "VRO",
    "name": "Kawama Airport",
    "city": "Santa Marta",
    "country": "CU"
  },
  {
    "code": "VRU",
    "name": "Vryburg Airport",
    "city": "Vyrburg",
    "country": "ZA"
  },
  {
    "code": "VSA",
    "name": "Carlos Rovirosa Pérez International Airport",
    "city": "Villahermosa",
    "country": "MX"
  },
  {
    "code": "VSE",
    "name": "Aerodromo Goncalves Lobato (Viseu Airport)",
    "city": "Viseu",
    "country": "PT"
  },
  {
    "code": "VST",
    "name": "Stockholm Västerås Airport",
    "city": "Stockholm / Västerås",
    "country": "SE"
  },
  {
    "code": "VTB",
    "name": "Vitebsk Vostochny Airport",
    "city": "Vitebsk",
    "country": "BY"
  },
  {
    "code": "VTE",
    "name": "Wattay International Airport",
    "city": "Vientiane",
    "country": "LA"
  },
  {
    "code": "VTM",
    "name": "Nevatim Air Base",
    "city": "Beersheba",
    "country": "IL"
  },
  {
    "code": "VTN",
    "name": "Miller Field",
    "city": "Valentine",
    "country": "US"
  },
  {
    "code": "VTU",
    "name": "Hermanos Ameijeiras Airport",
    "city": "Las Tunas",
    "country": "CU"
  },
  {
    "code": "VTZ",
    "name": "Visakhapatnam International Airport",
    "city": "Visakhapatnam",
    "country": "IN"
  },
  {
    "code": "VUP",
    "name": "Alfonso López Pumarejo Airport",
    "city": "Valledupar",
    "country": "CO"
  },
  {
    "code": "VUS",
    "name": "Velikiy Ustyug Airport",
    "city": "Velikiy Ustyug",
    "country": "RU"
  },
  {
    "code": "VVC",
    "name": "Vanguardia Airport",
    "city": "Villavicencio",
    "country": "CO"
  },
  {
    "code": "VVI",
    "name": "Viru Viru International Airport",
    "city": "Santa Cruz",
    "country": "BO"
  },
  {
    "code": "VVO",
    "name": "Vladivostok International Airport",
    "city": "Artyom",
    "country": "RU"
  },
  {
    "code": "VVZ",
    "name": "Illizi Takhamalt Airport",
    "city": "Illizi",
    "country": "DZ"
  },
  {
    "code": "VXC",
    "name": "Lichinga Airport",
    "city": "Lichinga",
    "country": "MZ"
  },
  {
    "code": "VXE",
    "name": "Cesaria Evora International Airport",
    "city": "São Pedro",
    "country": "CV"
  },
  {
    "code": "VXO",
    "name": "Växjö Kronoberg Airport",
    "city": "Växjö",
    "country": "SE"
  },
  {
    "code": "VYI",
    "name": "Vilyuisk Airport",
    "city": "Vilyuisk",
    "country": "RU"
  },
  {
    "code": "WAE",
    "name": "Wadi Al Dawasir Domestic Airport",
    "city": "Wadi Al Dawasir",
    "country": "SA"
  },
  {
    "code": "WAG",
    "name": "Wanganui Airport",
    "city": "Wanganui",
    "country": "NZ"
  },
  {
    "code": "WAI",
    "name": "Ambalabe Airport",
    "city": "Antsohihy",
    "country": "MG"
  },
  {
    "code": "WAT",
    "name": "Waterford Airport",
    "city": "Waterford",
    "country": "IE"
  },
  {
    "code": "WAW",
    "name": "Warsaw Chopin Airport",
    "city": "Warsaw",
    "country": "PL"
  },
  {
    "code": "WBG",
    "name": "Schleswig Air Base",
    "city": "Jagel",
    "country": "DE"
  },
  {
    "code": "WBM",
    "name": "Wapenamanda Airport",
    "city": "Wapenamanda",
    "country": "PG"
  },
  {
    "code": "WCH",
    "name": "Nuevo Chaitén Airport",
    "city": "Chaitén",
    "country": "CL"
  },
  {
    "code": "WDH",
    "name": "Hosea Kutako International Airport",
    "city": "Windhoek",
    "country": "NA"
  },
  {
    "code": "WDS",
    "name": "Shiyan Wudangshan Airport",
    "city": "Shiyan (Maojian)",
    "country": "CN"
  },
  {
    "code": "WEF",
    "name": "Weifang Nanyuan Airport",
    "city": "Weifang (Kuiwen)",
    "country": "CN"
  },
  {
    "code": "WEH",
    "name": "Weihai Dashuibo Airport",
    "city": "Weihai",
    "country": "CN"
  },
  {
    "code": "WEI",
    "name": "Weipa Airport",
    "city": "Weipa",
    "country": "AU"
  },
  {
    "code": "WFI",
    "name": "Fianarantsoa Airport",
    "city": "Fianarantsoa",
    "country": "MG"
  },
  {
    "code": "WFR",
    "name": "(Duplicate)Wolf's Fang Runway",
    "city": "Queen Maud Island",
    "country": "AQ"
  },
  {
    "code": "WGA",
    "name": "Wagga Wagga Airport",
    "city": "Forest Hill",
    "country": "AU"
  },
  {
    "code": "WGE",
    "name": "Walgett Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "WGN",
    "name": "Shaoyang Wugang Airport",
    "city": "Shaoyang (Wugang)",
    "country": "CN"
  },
  {
    "code": "WGT",
    "name": "Wangaratta Airport",
    "city": "Laceby",
    "country": "AU"
  },
  {
    "code": "WHA",
    "name": "Wuhu Xuanzhou Airport",
    "city": "Wuhu",
    "country": "CN"
  },
  {
    "code": "WHB",
    "name": "Eliwana",
    "city": null,
    "country": "AU"
  },
  {
    "code": "WHK",
    "name": "Whakatane Airport",
    "city": null,
    "country": "NZ"
  },
  {
    "code": "WHN",
    "name": "Wuhan Hannan Municipal Airport",
    "city": "Wuhan (Hannan)",
    "country": "CN"
  },
  {
    "code": "WIC",
    "name": "Wick John O'Groats Airport",
    "city": "Wick",
    "country": "GB"
  },
  {
    "code": "WIE",
    "name": "Wiesbaden Army Airfield",
    "city": "Wiesbaden",
    "country": "DE"
  },
  {
    "code": "WIL",
    "name": "Nairobi Wilson Airport",
    "city": "Nairobi",
    "country": "KE"
  },
  {
    "code": "WIN",
    "name": "Winton Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "WIR",
    "name": "Wairoa Airport",
    "city": "Wairoa",
    "country": "NZ"
  },
  {
    "code": "WJF",
    "name": "General William J Fox Airfield",
    "city": "Lancaster",
    "country": "US"
  },
  {
    "code": "WJR",
    "name": "Wajir Airport",
    "city": "Wajir",
    "country": "KE"
  },
  {
    "code": "WJU",
    "name": "Wonju Airport / Hoengseong Air Base (K-38/K-46)",
    "city": "Wonju",
    "country": "KR"
  },
  {
    "code": "WKA",
    "name": "Wanaka Airport",
    "city": "Wanaka",
    "country": "NZ"
  },
  {
    "code": "WKB",
    "name": "Warracknabeal Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "WKF",
    "name": "Waterkloof Air Force Base",
    "city": "Pretoria",
    "country": "ZA"
  },
  {
    "code": "WKJ",
    "name": "Wakkanai Airport",
    "city": "Wakkanai",
    "country": "JP"
  },
  {
    "code": "WKK",
    "name": "Aleknagik / New Airport",
    "city": "Aleknagik",
    "country": "US"
  },
  {
    "code": "WLG",
    "name": "Wellington International Airport",
    "city": "Wellington",
    "country": "NZ"
  },
  {
    "code": "WLS",
    "name": "Hihifo Airport",
    "city": "Wallis Island",
    "country": "WF"
  },
  {
    "code": "WMC",
    "name": "Winnemucca Municipal Airport",
    "city": "Winnemucca",
    "country": "US"
  },
  {
    "code": "WME",
    "name": "Mount Keith Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "WMH",
    "name": "Ozark Regional Airport",
    "city": "Mountain Home",
    "country": "US"
  },
  {
    "code": "WMI",
    "name": "Warsaw Modlin Airport",
    "city": "Nowy Dwór Mazowiecki",
    "country": "PL"
  },
  {
    "code": "WMN",
    "name": "Maroantsetra Airport",
    "city": "Maroantsetra",
    "country": "MG"
  },
  {
    "code": "WMR",
    "name": "Mananara Nord Airport",
    "city": "Mananara Nord",
    "country": "MG"
  },
  {
    "code": "WMT",
    "name": "Zunyi Maotai Airport",
    "city": "Zunyi",
    "country": "CN"
  },
  {
    "code": "WMX",
    "name": "Wamena Airport",
    "city": "Wamena",
    "country": "ID"
  },
  {
    "code": "WNI",
    "name": "Matahora Airport",
    "city": "Wangi-wangi Island",
    "country": "ID"
  },
  {
    "code": "WNP",
    "name": "Naga Airport",
    "city": "Naga",
    "country": "PH"
  },
  {
    "code": "WNR",
    "name": "Windorah Airport",
    "city": "Windorah",
    "country": "AU"
  },
  {
    "code": "WNS",
    "name": "Shaheed Benazirabad Airport",
    "city": "Nawabashah",
    "country": "PK"
  },
  {
    "code": "WNZ",
    "name": "Wenzhou Longwan International Airport",
    "city": "Wenzhou (Longwan)",
    "country": "CN"
  },
  {
    "code": "WOE",
    "name": "Woensdrecht Air Base",
    "city": "Hoogerheide",
    "country": "NL"
  },
  {
    "code": "WOL",
    "name": "Shellharbour Airport",
    "city": "Albion Park Rail",
    "country": "AU"
  },
  {
    "code": "WOS",
    "name": "Wonsan Kalma International Airport",
    "city": "Wonsan",
    "country": "KP"
  },
  {
    "code": "WPC",
    "name": "Pincher Creek Airport",
    "city": "Pincher Creek",
    "country": "CA"
  },
  {
    "code": "WPR",
    "name": "Captain Fuentes Martinez Airport",
    "city": "Porvenir",
    "country": "CL"
  },
  {
    "code": "WPU",
    "name": "Guardia Marina Zañartu Airport",
    "city": "Puerto Williams",
    "country": "CL"
  },
  {
    "code": "WRB",
    "name": "Robins Air Force Base",
    "city": "Warner Robins",
    "country": "US"
  },
  {
    "code": "WRE",
    "name": "Whangarei Airport",
    "city": "Whangarei",
    "country": "NZ"
  },
  {
    "code": "WRG",
    "name": "Wrangell Airport",
    "city": "Wrangell",
    "country": "US"
  },
  {
    "code": "WRI",
    "name": "Mc Guire Air Force Base",
    "city": "Wrightstown",
    "country": "US"
  },
  {
    "code": "WRL",
    "name": "Worland Municipal Airport",
    "city": "Worland",
    "country": "US"
  },
  {
    "code": "WRO",
    "name": "Copernicus Wrocław Airport",
    "city": "Wrocław",
    "country": "PL"
  },
  {
    "code": "WRT",
    "name": "Warton Aerodrome",
    "city": "Warton",
    "country": "GB"
  },
  {
    "code": "WST",
    "name": "Westerly State Airport",
    "city": "Westerly",
    "country": "US"
  },
  {
    "code": "WSZ",
    "name": "Westport Airport",
    "city": "Westport",
    "country": "NZ"
  },
  {
    "code": "WTB",
    "name": "Toowoomba Wellcamp Airport",
    "city": "Toowoomba",
    "country": "AU"
  },
  {
    "code": "WTN",
    "name": "RAF Waddington",
    "city": "Lincoln, Lincolnshire",
    "country": "GB"
  },
  {
    "code": "WUH",
    "name": "Wuhan Tianhe International Airport",
    "city": "Wuhan (Huangpi)",
    "country": "CN"
  },
  {
    "code": "WUN",
    "name": "Wiluna Airport",
    "city": null,
    "country": "AU"
  },
  {
    "code": "WUS",
    "name": "Nanping Wuyishan Airport",
    "city": "Wuyishan",
    "country": "CN"
  },
  {
    "code": "WUU",
    "name": "Wau Airport",
    "city": "Wau",
    "country": "SS"
  },
  {
    "code": "WUX",
    "name": "Sunan Shuofang International Airport",
    "city": "Wuxi",
    "country": "CN"
  },
  {
    "code": "WUZ",
    "name": "Wuzhou Xijiang Airport",
    "city": "Tangbu",
    "country": "CN"
  },
  {
    "code": "WVB",
    "name": "Walvis Bay International Airport",
    "city": "Walvis Bay(Rooikop)",
    "country": "NA"
  },
  {
    "code": "WVK",
    "name": "Manakara Airport",
    "city": "Manakara",
    "country": "MG"
  },
  {
    "code": "WWA",
    "name": "Wasilla Airport",
    "city": "Wasilla",
    "country": "US"
  },
  {
    "code": "WWD",
    "name": "Cape May County Airport",
    "city": "Wildwood",
    "country": "US"
  },
  {
    "code": "WWK",
    "name": "Wewak International Airport",
    "city": "Wewak",
    "country": "PG"
  },
  {
    "code": "WWR",
    "name": "West Woodward Airport",
    "city": "Woodward",
    "country": "US"
  },
  {
    "code": "WWY",
    "name": "West Wyalong Airport",
    "city": "West Wyalong",
    "country": "AU"
  },
  {
    "code": "WYA",
    "name": "Whyalla Airport",
    "city": "Whyalla",
    "country": "AU"
  },
  {
    "code": "WYE",
    "name": "Yengema Airport",
    "city": "Yengema",
    "country": "SL"
  },
  {
    "code": "WYS",
    "name": "Yellowstone Airport",
    "city": "West Yellowstone",
    "country": "US"
  },
  {
    "code": "XAI",
    "name": "Xinyang Minggang Airport",
    "city": "Xinyang",
    "country": "CN"
  },
  {
    "code": "XAP",
    "name": "Serafin Enoss Bertaso Airport",
    "city": "Chapecó",
    "country": "BR"
  },
  {
    "code": "XBJ",
    "name": "Birjand International Airport",
    "city": "Birjand",
    "country": "IR"
  },
  {
    "code": "XCH",
    "name": "Christmas Island International Airport",
    "city": "Flying Fish Cove",
    "country": "CX"
  },
  {
    "code": "XCR",
    "name": "Chalons Vatry airport",
    "city": "Chalons en Champagne",
    "country": "FR"
  },
  {
    "code": "XEN",
    "name": "Xingcheng Air Base",
    "city": "Huludao (Xingcheng)",
    "country": "CN"
  },
  {
    "code": "XFN",
    "name": "Xiangyang Liuji Airport",
    "city": "Xiangyang (Xiangzhou)",
    "country": "CN"
  },
  {
    "code": "XFW",
    "name": "Hamburg-Finkenwerder Airport",
    "city": "Hamburg",
    "country": "DE"
  },
  {
    "code": "XGN",
    "name": "Xangongo Airport",
    "city": "Xangongo",
    "country": "AO"
  },
  {
    "code": "XIC",
    "name": "Xichang Qingshan Airport",
    "city": "Liangshan (Xichang)",
    "country": "CN"
  },
  {
    "code": "XIJ",
    "name": "Ahmed Al Jaber Air Base",
    "city": "Ahmed Al Jaber AB",
    "country": "KW"
  },
  {
    "code": "XIL",
    "name": "Xilinhot Airport",
    "city": "Xilinhot",
    "country": "CN"
  },
  {
    "code": "XIY",
    "name": "Xi'an Xianyang International Airport",
    "city": "Xianyang (Weicheng)",
    "country": "CN"
  },
  {
    "code": "XJD",
    "name": "Al Udeid Air Base",
    "city": "Ar Rayyan",
    "country": "QA"
  },
  {
    "code": "XJM",
    "name": "Mangla Airport",
    "city": "Mangla",
    "country": "PK"
  },
  {
    "code": "XKS",
    "name": "Kasabonika Airport",
    "city": "Kasabonika",
    "country": "CA"
  },
  {
    "code": "XLS",
    "name": "Saint Louis Airport",
    "city": "Saint Louis",
    "country": "SN"
  },
  {
    "code": "XMH",
    "name": "Manihi Airport",
    "city": null,
    "country": "PF"
  },
  {
    "code": "XMN",
    "name": "Xiamen Gaoqi International Airport",
    "city": "Xiamen",
    "country": "CN"
  },
  {
    "code": "XMS",
    "name": "Coronel E Carvajal Airport",
    "city": "Macas",
    "country": "EC"
  },
  {
    "code": "XNA",
    "name": "Northwest Arkansas National Airport",
    "city": "Fayetteville/Springdale/Rogers",
    "country": "US"
  },
  {
    "code": "XNH",
    "name": "Ali Air Base",
    "city": "Nasiriyah",
    "country": "IQ"
  },
  {
    "code": "XNN",
    "name": "Xining Caojiabao International Airport",
    "city": "Haidong (Huzhu Tu Autonomous County)",
    "country": "CN"
  },
  {
    "code": "XPL",
    "name": "Palmerola International Airport / José Enrique Soto Cano Air Base",
    "city": "Palmerola",
    "country": "HN"
  },
  {
    "code": "XQP",
    "name": "Quepos Managua Airport",
    "city": "Quepos",
    "country": "CR"
  },
  {
    "code": "XQU",
    "name": "Qualicum Beach Airport",
    "city": "Qualicum Beach",
    "country": "CA"
  },
  {
    "code": "XRH",
    "name": "RAAF Base Richmond",
    "city": "Richmond",
    "country": "AU"
  },
  {
    "code": "XRR",
    "name": "Ross River Airport",
    "city": "Ross River",
    "country": "CA"
  },
  {
    "code": "XRY",
    "name": "Jerez Airport",
    "city": "Jerez de la Frontera",
    "country": "ES"
  },
  {
    "code": "XSB",
    "name": "Sir Bani Yas Airport",
    "city": "Sir Bani Yas",
    "country": "AE"
  },
  {
    "code": "XSC",
    "name": "South Caicos Airport",
    "city": "South Caicos",
    "country": "TC"
  },
  {
    "code": "XSP",
    "name": "Seletar Airport",
    "city": "Seletar",
    "country": "SG"
  },
  {
    "code": "XTG",
    "name": "Thargomindah Airport",
    "city": "Thargomindah",
    "country": "AU"
  },
  {
    "code": "XUZ",
    "name": "Xuzhou Guanyin International Airport",
    "city": "Xuzhou",
    "country": "CN"
  },
  {
    "code": "XWA",
    "name": "Williston Basin International Airport",
    "city": "Williston",
    "country": "US"
  },
  {
    "code": "YAA",
    "name": "Anahim Lake Airport",
    "city": "Anahim Lake",
    "country": "CA"
  },
  {
    "code": "YAG",
    "name": "Fort Frances Municipal Airport",
    "city": "Fort Frances",
    "country": "CA"
  },
  {
    "code": "YAH",
    "name": "La Grande-4 Airport",
    "city": "La Grande-4",
    "country": "CA"
  },
  {
    "code": "YAI",
    "name": "Gral. Bernardo O´Higgins Airport",
    "city": "Chillan",
    "country": "CL"
  },
  {
    "code": "YAK",
    "name": "Yakutat Airport",
    "city": "Yakutat",
    "country": "US"
  },
  {
    "code": "YAM",
    "name": "Sault Ste Marie Airport",
    "city": "Sault Ste Marie",
    "country": "CA"
  },
  {
    "code": "YAO",
    "name": "Yaoundé Ville Airport",
    "city": "Yaoundé",
    "country": "CM"
  },
  {
    "code": "YAP",
    "name": "Yap International Airport",
    "city": "Yap Island",
    "country": "FM"
  },
  {
    "code": "YAY",
    "name": "St. Anthony Airport",
    "city": "St. Anthony",
    "country": "CA"
  },
  {
    "code": "YAZ",
    "name": "Tofino / Long Beach Airport",
    "city": "Tofino",
    "country": "CA"
  },
  {
    "code": "YBC",
    "name": "Baie-Comeau Airport",
    "city": "Baie-Comeau",
    "country": "CA"
  },
  {
    "code": "YBG",
    "name": "Saguenay-Bagotville Airport",
    "city": "Saguenay",
    "country": "CA"
  },
  {
    "code": "YBK",
    "name": "Baker Lake Airport",
    "city": "Baker Lake",
    "country": "CA"
  },
  {
    "code": "YBL",
    "name": "Campbell River Airport",
    "city": "Campbell River",
    "country": "CA"
  },
  {
    "code": "YBP",
    "name": "Yibin Wuliangye Airport",
    "city": "Yibin (Cuiping)",
    "country": "CN"
  },
  {
    "code": "YBR",
    "name": "Brandon Municipal Airport",
    "city": "Brandon",
    "country": "CA"
  },
  {
    "code": "YBX",
    "name": "Lourdes-de-Blanc-Sablon Airport",
    "city": "Blanc-Sablon",
    "country": "CA"
  },
  {
    "code": "YBY",
    "name": "Bonnyville Airport",
    "city": "Bonnyville",
    "country": "CA"
  },
  {
    "code": "YCB",
    "name": "Cambridge Bay Airport",
    "city": "Cambridge Bay",
    "country": "CA"
  },
  {
    "code": "YCC",
    "name": "Cornwall Regional Airport",
    "city": "Cornwall",
    "country": "CA"
  },
  {
    "code": "YCD",
    "name": "Nanaimo Airport",
    "city": "Nanaimo",
    "country": "CA"
  },
  {
    "code": "YCE",
    "name": "Centralia / James T. Field Memorial Aerodrome",
    "city": "Huron Park",
    "country": "CA"
  },
  {
    "code": "YCG",
    "name": "Castlegar/West Kootenay Regional Airport",
    "city": "Castlegar",
    "country": "CA"
  },
  {
    "code": "YCH",
    "name": "Miramichi Airport",
    "city": "Miramichi",
    "country": "CA"
  },
  {
    "code": "YCL",
    "name": "Charlo Airport",
    "city": "Charlo",
    "country": "CA"
  },
  {
    "code": "YCM",
    "name": "Niagara District Airport",
    "city": "Niagara-on-the-Lake",
    "country": "CA"
  },
  {
    "code": "YCN",
    "name": "Cochrane Airport",
    "city": "Cochrane",
    "country": "CA"
  },
  {
    "code": "YCQ",
    "name": "Chetwynd Airport",
    "city": "Chetwynd",
    "country": "CA"
  },
  {
    "code": "YCU",
    "name": "Yuncheng Yanhu International Airport",
    "city": "Yuncheng (Yanhu)",
    "country": "CN"
  },
  {
    "code": "YDA",
    "name": "Dawson City Airport",
    "city": "Dawson City",
    "country": "CA"
  },
  {
    "code": "YDB",
    "name": "Burwash Airport",
    "city": "Burwash Landing",
    "country": "CA"
  },
  {
    "code": "YDF",
    "name": "Deer Lake Airport",
    "city": "Deer Lake",
    "country": "CA"
  },
  {
    "code": "YDG",
    "name": "Digby / Annapolis Regional Airport",
    "city": "Digby",
    "country": "CA"
  },
  {
    "code": "YDN",
    "name": "Dauphin Barker Airport",
    "city": "Dauphin",
    "country": "CA"
  },
  {
    "code": "YDO",
    "name": "Dolbeau-Saint-Felicien Airport",
    "city": "Dolbeau-Saint-Felicien",
    "country": "CA"
  },
  {
    "code": "YDQ",
    "name": "Dawson Creek Airport",
    "city": "Dawson Creek",
    "country": "CA"
  },
  {
    "code": "YDT",
    "name": "Boundary Bay Airport",
    "city": "Delta",
    "country": "CA"
  },
  {
    "code": "YEC",
    "name": "Yecheon Airbase",
    "city": "Yecheon-ri",
    "country": "KR"
  },
  {
    "code": "YEG",
    "name": "Edmonton International Airport",
    "city": "Edmonton",
    "country": "CA"
  },
  {
    "code": "YEI",
    "name": "Bursa Yenişehir Airport",
    "city": "Yenişehir",
    "country": "TR"
  },
  {
    "code": "YEL",
    "name": "Elliot Lake Municipal Airport",
    "city": "Elliot Lake",
    "country": "CA"
  },
  {
    "code": "YEM",
    "name": "Manitoulin East Municipal Airport",
    "city": "Sheguiandah",
    "country": "CA"
  },
  {
    "code": "YEN",
    "name": "Estevan Airport",
    "city": "Estevan",
    "country": "CA"
  },
  {
    "code": "YEO",
    "name": "RNAS Yeovilton",
    "city": "Yeovil, Somerset",
    "country": "GB"
  },
  {
    "code": "YES",
    "name": "Yasuj Airport",
    "city": "Yasuj",
    "country": "IR"
  },
  {
    "code": "YET",
    "name": "Edson Airport",
    "city": "Edson",
    "country": "CA"
  },
  {
    "code": "YEV",
    "name": "Inuvik Mike Zubko Airport",
    "city": "Inuvik",
    "country": "CA"
  },
  {
    "code": "YEY",
    "name": "Amos/Magny Airport",
    "city": "Amos",
    "country": "CA"
  },
  {
    "code": "YFB",
    "name": "Iqaluit Airport",
    "city": "Iqaluit",
    "country": "CA"
  },
  {
    "code": "YFC",
    "name": "Fredericton International Airport",
    "city": "Fredericton",
    "country": "CA"
  },
  {
    "code": "YFE",
    "name": "Forestville Airport",
    "city": "Forestville",
    "country": "CA"
  },
  {
    "code": "YFR",
    "name": "Fort Resolution Airport",
    "city": "Fort Resolution",
    "country": "CA"
  },
  {
    "code": "YFS",
    "name": "Fort Simpson Airport",
    "city": "Fort Simpson",
    "country": "CA"
  },
  {
    "code": "YGJ",
    "name": "Yonago Kitaro Airport / JASDF Miho Air Base",
    "city": "Yonago",
    "country": "JP"
  },
  {
    "code": "YGK",
    "name": "Kingston Norman Rogers Airport",
    "city": "Kingston",
    "country": "CA"
  },
  {
    "code": "YGL",
    "name": "La Grande Rivière Airport",
    "city": "La Grande Rivière",
    "country": "CA"
  },
  {
    "code": "YGM",
    "name": "Gimli Industrial Park Airport",
    "city": "Gimli",
    "country": "CA"
  },
  {
    "code": "YGP",
    "name": "Michel-Pouliot Gaspé Airport",
    "city": "Gaspé",
    "country": "CA"
  },
  {
    "code": "YGQ",
    "name": "Geraldton Greenstone Regional Airport",
    "city": "Geraldton",
    "country": "CA"
  },
  {
    "code": "YGR",
    "name": "Îles-de-la-Madeleine Airport",
    "city": "Les Îles-de-la-Madeleine",
    "country": "CA"
  },
  {
    "code": "YGV",
    "name": "Havre-Saint-Pierre Airport",
    "city": "Havre-Saint-Pierre",
    "country": "CA"
  },
  {
    "code": "YGW",
    "name": "Kuujjuarapik Airport",
    "city": "Kuujjuarapik",
    "country": "CA"
  },
  {
    "code": "YHD",
    "name": "Dryden Regional Airport",
    "city": "Dryden",
    "country": "CA"
  },
  {
    "code": "YHF",
    "name": "Hearst René Fontaine Municipal Airport",
    "city": "Hearst",
    "country": "CA"
  },
  {
    "code": "YHM",
    "name": "John C. Munro Hamilton International Airport",
    "city": "Hamilton",
    "country": "CA"
  },
  {
    "code": "YHN",
    "name": "Hornepayne Municipal Airport",
    "city": "Hornepayne",
    "country": "CA"
  },
  {
    "code": "YHT",
    "name": "Haines Junction Airport",
    "city": "Haines Junction",
    "country": "CA"
  },
  {
    "code": "YHU",
    "name": "Montréal / Saint-Hubert Metropolitan Airport",
    "city": "Montréal",
    "country": "CA"
  },
  {
    "code": "YHY",
    "name": "Hay River / Merlyn Carter Airport",
    "city": "Hay River",
    "country": "CA"
  },
  {
    "code": "YHZ",
    "name": "Halifax / Stanfield International Airport",
    "city": "Halifax",
    "country": "CA"
  },
  {
    "code": "YIA",
    "name": "Yogyakarta International Airport",
    "city": "Yogyakarta",
    "country": "ID"
  },
  {
    "code": "YIB",
    "name": "Atikokan Municipal Airport",
    "city": "Atikokan",
    "country": "CA"
  },
  {
    "code": "YIC",
    "name": "Yichun Mingyueshan Airport",
    "city": "Yichun",
    "country": "CN"
  },
  {
    "code": "YIE",
    "name": "Arxan Yi'ershi Airport",
    "city": "Arxan",
    "country": "CN"
  },
  {
    "code": "YIF",
    "name": "St Augustin Airport",
    "city": "St-Augustin",
    "country": "CA"
  },
  {
    "code": "YIH",
    "name": "Yichang Sanxia Airport",
    "city": "Yichang (Xiaoting)",
    "country": "CN"
  },
  {
    "code": "YIP",
    "name": "Willow Run Airport",
    "city": "Detroit",
    "country": "US"
  },
  {
    "code": "YIV",
    "name": "Island Lake Airport",
    "city": "Island Lake",
    "country": "CA"
  },
  {
    "code": "YIW",
    "name": "Yiwu Airport",
    "city": "Jinhua (Yiwu)",
    "country": "CN"
  },
  {
    "code": "YJF",
    "name": "Fort Liard Airport",
    "city": "Fort Liard",
    "country": "CA"
  },
  {
    "code": "YJN",
    "name": "St Jean Airport",
    "city": "St Jean",
    "country": "CA"
  },
  {
    "code": "YJT",
    "name": "Stephenville Dymond International Airport",
    "city": "Stephenville",
    "country": "CA"
  },
  {
    "code": "YKA",
    "name": "Kamloops John Moose Fulton Field Regional Airport",
    "city": "Kamloops",
    "country": "CA"
  },
  {
    "code": "YKD",
    "name": "Kincardine Municipal Airport",
    "city": "Kincardine",
    "country": "CA"
  },
  {
    "code": "YKF",
    "name": "Region of Waterloo International Airport",
    "city": "Breslau",
    "country": "CA"
  },
  {
    "code": "YKH",
    "name": "Yingkou Lanqi Airport",
    "city": "Yingkou (Laobian)",
    "country": "CN"
  },
  {
    "code": "YKJ",
    "name": "Key Lake Airport",
    "city": "Key Lake",
    "country": "CA"
  },
  {
    "code": "YKL",
    "name": "Schefferville Airport",
    "city": "Schefferville",
    "country": "CA"
  },
  {
    "code": "YKM",
    "name": "Yakima Air Terminal McAllister Field",
    "city": "Yakima",
    "country": "US"
  },
  {
    "code": "YKN",
    "name": "Chan Gurney Municipal Airport",
    "city": "Yankton",
    "country": "US"
  },
  {
    "code": "YKO",
    "name": "Hakkari Yüksekova Airport",
    "city": "Hakkari",
    "country": "TR"
  },
  {
    "code": "YKS",
    "name": "Platon Oyunsky Yakutsk International Airport",
    "city": "Yakutsk",
    "country": "RU"
  },
  {
    "code": "YKX",
    "name": "Kirkland Lake Airport",
    "city": "Kirkland Lake",
    "country": "CA"
  },
  {
    "code": "YKY",
    "name": "Kindersley Airport",
    "city": "Kindersley",
    "country": "CA"
  },
  {
    "code": "YLD",
    "name": "Chapleau Airport",
    "city": "Chapleau",
    "country": "CA"
  },
  {
    "code": "YLI",
    "name": "Ylivieska Airfield",
    "city": "Ylivieska",
    "country": "FI"
  },
  {
    "code": "YLJ",
    "name": "Meadow Lake Airport",
    "city": "Meadow Lake",
    "country": "CA"
  },
  {
    "code": "YLK",
    "name": "Barrie-Lake Simcoe Regional Airport",
    "city": "Barrie",
    "country": "CA"
  },
  {
    "code": "YLL",
    "name": "Lloydminster Airport",
    "city": "Lloydminster",
    "country": "CA"
  },
  {
    "code": "YLR",
    "name": "Leaf Rapids Airport",
    "city": "Leaf Rapids",
    "country": "CA"
  },
  {
    "code": "YLT",
    "name": "Alert Airport",
    "city": "Alert",
    "country": "CA"
  },
  {
    "code": "YLW",
    "name": "Kelowna International Airport",
    "city": "Kelowna",
    "country": "CA"
  },
  {
    "code": "YLX",
    "name": "Yulin Fumian Airport",
    "city": "Yùlín",
    "country": "CN"
  },
  {
    "code": "YLY",
    "name": "Langley Airport",
    "city": "Langley",
    "country": "CA"
  },
  {
    "code": "YMA",
    "name": "Mayo Airport",
    "city": "Mayo",
    "country": "CA"
  },
  {
    "code": "YME",
    "name": "Matane Airport",
    "city": "Matane",
    "country": "CA"
  },
  {
    "code": "YMG",
    "name": "Manitouwadge Airport",
    "city": "Manitouwadge",
    "country": "CA"
  },
  {
    "code": "YMJ",
    "name": "Moose Jaw Air Vice Marshal C. M. McEwen Airport",
    "city": "Moose Jaw",
    "country": "CA"
  },
  {
    "code": "YML",
    "name": "Charlevoix Airport",
    "city": "Charlevoix",
    "country": "CA"
  },
  {
    "code": "YMM",
    "name": "Fort McMurray International Airport",
    "city": "Fort McMurray",
    "country": "CA"
  },
  {
    "code": "YMO",
    "name": "Moosonee Airport",
    "city": "Moosonee",
    "country": "CA"
  },
  {
    "code": "YMS",
    "name": "Moises Benzaquen Rengifo Airport",
    "city": "Yurimaguas",
    "country": "PE"
  },
  {
    "code": "YMT",
    "name": "Chapais Airport",
    "city": "Chibougamau",
    "country": "CA"
  },
  {
    "code": "YMX",
    "name": "Montreal Mirabel International Airport",
    "city": "Montréal",
    "country": "CA"
  },
  {
    "code": "YNA",
    "name": "Natashquan Airport",
    "city": "Natashquan",
    "country": "CA"
  },
  {
    "code": "YNB",
    "name": "Prince Abdul Mohsin bin Abdulaziz International Airport / Yanbu Airport",
    "city": "Yanbu",
    "country": "SA"
  },
  {
    "code": "YND",
    "name": "Ottawa / Gatineau Airport",
    "city": "Gatineau",
    "country": "CA"
  },
  {
    "code": "YNG",
    "name": "Youngstown Warren Regional Airport",
    "city": "Youngstown/Warren",
    "country": "US"
  },
  {
    "code": "YNJ",
    "name": "Yanji Chaoyangchuan Airport",
    "city": "Yanji",
    "country": "CN"
  },
  {
    "code": "YNL",
    "name": "Points North Landing Airport",
    "city": "Points North Landing",
    "country": "CA"
  },
  {
    "code": "YNM",
    "name": "Matagami Airport",
    "city": "Matagami",
    "country": "CA"
  },
  {
    "code": "YNT",
    "name": "Yantai Penglai International Airport",
    "city": "Yantai",
    "country": "CN"
  },
  {
    "code": "YNY",
    "name": "Yangyang International Airport",
    "city": "Gonghang-ro",
    "country": "KR"
  },
  {
    "code": "YNZ",
    "name": "Yancheng Nanyang International Airport",
    "city": "Yancheng (Tinghu)",
    "country": "CN"
  },
  {
    "code": "YOA",
    "name": "Ekati Airport",
    "city": "Ekati",
    "country": "CA"
  },
  {
    "code": "YOD",
    "name": "CFB Cold Lake",
    "city": "Cold Lake",
    "country": "CA"
  },
  {
    "code": "YOJ",
    "name": "High Level Airport",
    "city": "High Level",
    "country": "CA"
  },
  {
    "code": "YOL",
    "name": "Yola Airport",
    "city": "Yola",
    "country": "NG"
  },
  {
    "code": "YOO",
    "name": "Oshawa Executive Airport",
    "city": "Oshawa",
    "country": "CA"
  },
  {
    "code": "YOP",
    "name": "Rainbow Lake Airport",
    "city": "Rainbow Lake",
    "country": "CA"
  },
  {
    "code": "YOS",
    "name": "Owen Sound / Billy Bishop Regional Airport",
    "city": "Owen Sound",
    "country": "CA"
  },
  {
    "code": "YOW",
    "name": "Ottawa Macdonald-Cartier International Airport",
    "city": "Ottawa",
    "country": "CA"
  },
  {
    "code": "YPA",
    "name": "Prince Albert Glass Field",
    "city": "Prince Albert",
    "country": "CA"
  },
  {
    "code": "YPE",
    "name": "Peace River Airport",
    "city": "Peace River",
    "country": "CA"
  },
  {
    "code": "YPG",
    "name": "Portage-la-Prairie / Southport Airport",
    "city": "Portage la Prairie",
    "country": "CA"
  },
  {
    "code": "YPL",
    "name": "Pickle Lake Airport",
    "city": "Pickle Lake",
    "country": "CA"
  },
  {
    "code": "YPN",
    "name": "Port-Menier Airport",
    "city": "Port-Menier",
    "country": "CA"
  },
  {
    "code": "YPQ",
    "name": "Peterborough Municipal Airport",
    "city": "Peterborough",
    "country": "CA"
  },
  {
    "code": "YPR",
    "name": "Prince Rupert Airport",
    "city": "Prince Rupert",
    "country": "CA"
  },
  {
    "code": "YPS",
    "name": "Port Hawkesbury Airport",
    "city": "Port Hawkesbury",
    "country": "CA"
  },
  {
    "code": "YPW",
    "name": "Powell River Airport",
    "city": "Powell River",
    "country": "CA"
  },
  {
    "code": "YPX",
    "name": "Puvirnituq Airport",
    "city": "Puvirnituq",
    "country": "CA"
  },
  {
    "code": "YPY",
    "name": "Fort Chipewyan Airport",
    "city": "Fort Chipewyan",
    "country": "CA"
  },
  {
    "code": "YPZ",
    "name": "Burns Lake Airport",
    "city": "Burns Lake",
    "country": "CA"
  },
  {
    "code": "YQA",
    "name": "Muskoka Airport",
    "city": "Gravenhurst",
    "country": "CA"
  },
  {
    "code": "YQB",
    "name": "Quebec Jean Lesage International Airport",
    "city": "Quebec",
    "country": "CA"
  },
  {
    "code": "YQD",
    "name": "The Pas Airport",
    "city": "The Pas",
    "country": "CA"
  },
  {
    "code": "YQF",
    "name": "Red Deer Regional Airport",
    "city": "Springbrook",
    "country": "CA"
  },
  {
    "code": "YQG",
    "name": "Windsor International Airport",
    "city": "Windsor",
    "country": "CA"
  },
  {
    "code": "YQH",
    "name": "Watson Lake Airport",
    "city": "Watson Lake",
    "country": "CA"
  },
  {
    "code": "YQI",
    "name": "Yarmouth Airport",
    "city": "Yarmouth",
    "country": "CA"
  },
  {
    "code": "YQK",
    "name": "Kenora Airport",
    "city": "Kenora",
    "country": "CA"
  },
  {
    "code": "YQL",
    "name": "Lethbridge County Airport",
    "city": "Lethbridge",
    "country": "CA"
  },
  {
    "code": "YQM",
    "name": "Greater Moncton Roméo LeBlanc International Airport",
    "city": "Moncton",
    "country": "CA"
  },
  {
    "code": "YQN",
    "name": "Nakina Airport",
    "city": "Nakina",
    "country": "CA"
  },
  {
    "code": "YQQ",
    "name": "Comox Valley International Airport / CFB Comox",
    "city": "Comox",
    "country": "CA"
  },
  {
    "code": "YQR",
    "name": "Regina International Airport",
    "city": "Regina",
    "country": "CA"
  },
  {
    "code": "YQS",
    "name": "St Thomas Municipal Airport",
    "city": "St Thomas",
    "country": "CA"
  },
  {
    "code": "YQT",
    "name": "Thunder Bay International Airport",
    "city": "Thunder Bay",
    "country": "CA"
  },
  {
    "code": "YQU",
    "name": "Grande Prairie Airport",
    "city": "Grande Prairie",
    "country": "CA"
  },
  {
    "code": "YQV",
    "name": "Yorkton Municipal Airport",
    "city": "Yorkton",
    "country": "CA"
  },
  {
    "code": "YQW",
    "name": "North Battleford Airport",
    "city": "North Battleford",
    "country": "CA"
  },
  {
    "code": "YQX",
    "name": "Gander International Airport",
    "city": "Gander",
    "country": "CA"
  },
  {
    "code": "YQY",
    "name": "Sydney / J.A. Douglas McCurdy Airport",
    "city": "Sydney",
    "country": "CA"
  },
  {
    "code": "YQZ",
    "name": "Quesnel Airport",
    "city": "Quesnel",
    "country": "CA"
  },
  {
    "code": "YRB",
    "name": "Resolute Bay Airport",
    "city": "Resolute Bay",
    "country": "CA"
  },
  {
    "code": "YRI",
    "name": "Rivière-du-Loup Airport",
    "city": "Rivière-du-Loup",
    "country": "CA"
  },
  {
    "code": "YRJ",
    "name": "Roberval Airport",
    "city": "Roberval",
    "country": "CA"
  },
  {
    "code": "YRL",
    "name": "Red Lake Airport",
    "city": "Red Lake",
    "country": "CA"
  },
  {
    "code": "YRO",
    "name": "Ottawa / Rockcliffe Airport",
    "city": "Ottawa",
    "country": "CA"
  },
  {
    "code": "YRQ",
    "name": "Trois-Rivières Airport",
    "city": "Trois-Rivières",
    "country": "CA"
  },
  {
    "code": "YRT",
    "name": "Rankin Inlet Airport",
    "city": "Rankin Inlet",
    "country": "CA"
  },
  {
    "code": "YRV",
    "name": "Revelstoke Airport",
    "city": "Revelstoke",
    "country": "CA"
  },
  {
    "code": "YSB",
    "name": "Sudbury Airport",
    "city": "Sudbury",
    "country": "CA"
  },
  {
    "code": "YSC",
    "name": "Sherbrooke Airport",
    "city": "Sherbrooke",
    "country": "CA"
  },
  {
    "code": "YSF",
    "name": "Stony Rapids Airport",
    "city": "Stony Rapids",
    "country": "CA"
  },
  {
    "code": "YSH",
    "name": "Smiths Falls-Montague (Russ Beach) Airport",
    "city": "Smiths Falls",
    "country": "CA"
  },
  {
    "code": "YSJ",
    "name": "Saint John Airport",
    "city": "Saint John",
    "country": "CA"
  },
  {
    "code": "YSL",
    "name": "Saint-Léonard Airport",
    "city": "Saint-Léonard",
    "country": "CA"
  },
  {
    "code": "YSM",
    "name": "Fort Smith Airport",
    "city": "Fort Smith",
    "country": "CA"
  },
  {
    "code": "YSN",
    "name": "Shuswap Regional Airport",
    "city": "Salmon Arm",
    "country": "CA"
  },
  {
    "code": "YSP",
    "name": "Marathon Airport",
    "city": "Marathon",
    "country": "CA"
  },
  {
    "code": "YSQ",
    "name": "Songyuan Chaganhu Airport",
    "city": "Qian Gorlos Mongol Autonomous County",
    "country": "CN"
  },
  {
    "code": "YSU",
    "name": "Summerside Airport",
    "city": "Slemon Park",
    "country": "CA"
  },
  {
    "code": "YTA",
    "name": "Pembroke Airport",
    "city": "Pembroke",
    "country": "CA"
  },
  {
    "code": "YTD",
    "name": "Thicket Portage Airport",
    "city": "Thicket Portage",
    "country": "CA"
  },
  {
    "code": "YTF",
    "name": "Alma Airport",
    "city": "Alma",
    "country": "CA"
  },
  {
    "code": "YTH",
    "name": "Thompson Airport",
    "city": "Thompson",
    "country": "CA"
  },
  {
    "code": "YTM",
    "name": "Mont-Tremblant International Airport",
    "city": "La Macaza",
    "country": "CA"
  },
  {
    "code": "YTR",
    "name": "CFB Trenton",
    "city": "Trenton",
    "country": "CA"
  },
  {
    "code": "YTS",
    "name": "Timmins/Victor M. Power",
    "city": "Timmins",
    "country": "CA"
  },
  {
    "code": "YTY",
    "name": "Yangzhou Taizhou Airport",
    "city": "Yangzhou",
    "country": "CN"
  },
  {
    "code": "YTZ",
    "name": "Billy Bishop Toronto City Airport",
    "city": "Toronto",
    "country": "CA"
  },
  {
    "code": "YUA",
    "name": "Yuanmou Air Base",
    "city": "Chuxiong (Yuanmou)",
    "country": "CN"
  },
  {
    "code": "YUL",
    "name": "Montreal / Pierre Elliott Trudeau International Airport",
    "city": "Montréal",
    "country": "CA"
  },
  {
    "code": "YUM",
    "name": "Yuma International Airport / Marine Corps Air Station Yuma",
    "city": "Yuma",
    "country": "US"
  },
  {
    "code": "YUS",
    "name": "Yushu Batang Airport",
    "city": "Yushu (Batang)",
    "country": "CN"
  },
  {
    "code": "YUX",
    "name": "Hall Beach Airport",
    "city": "Sanirajak",
    "country": "CA"
  },
  {
    "code": "YUY",
    "name": "Rouyn Noranda Airport",
    "city": "Rouyn-Noranda",
    "country": "CA"
  },
  {
    "code": "YVB",
    "name": "Bonaventure Airport",
    "city": "Bonaventure",
    "country": "CA"
  },
  {
    "code": "YVC",
    "name": "La Ronge Airport",
    "city": "La Ronge",
    "country": "CA"
  },
  {
    "code": "YVE",
    "name": "Vernon Regional Airport",
    "city": "Vernon",
    "country": "CA"
  },
  {
    "code": "YVO",
    "name": "Val-d'Or Airport",
    "city": "Val-d'Or",
    "country": "CA"
  },
  {
    "code": "YVP",
    "name": "Kuujjuaq Airport",
    "city": "Kuujjuaq",
    "country": "CA"
  },
  {
    "code": "YVQ",
    "name": "Norman Wells Airport",
    "city": "Norman Wells",
    "country": "CA"
  },
  {
    "code": "YVR",
    "name": "Vancouver International Airport",
    "city": "Vancouver",
    "country": "CA"
  },
  {
    "code": "YVV",
    "name": "Wiarton Airport",
    "city": "Wiarton",
    "country": "CA"
  },
  {
    "code": "YWG",
    "name": "Winnipeg / James Armstrong Richardson International Airport",
    "city": "Winnipeg",
    "country": "CA"
  },
  {
    "code": "YWK",
    "name": "Wabush Airport",
    "city": "Wabush",
    "country": "CA"
  },
  {
    "code": "YWL",
    "name": "Williams Lake Airport",
    "city": "Williams Lake",
    "country": "CA"
  },
  {
    "code": "YWY",
    "name": "Wrigley Airport",
    "city": "Wrigley",
    "country": "CA"
  },
  {
    "code": "YXC",
    "name": "Cranbrook/Canadian Rockies International Airport",
    "city": "Cranbrook",
    "country": "CA"
  },
  {
    "code": "YXE",
    "name": "Saskatoon John G. Diefenbaker International Airport",
    "city": "Saskatoon",
    "country": "CA"
  },
  {
    "code": "YXH",
    "name": "Medicine Hat Regional Airport",
    "city": "Medicine Hat",
    "country": "CA"
  },
  {
    "code": "YXJ",
    "name": "Fort St John / North Peace Regional Airport",
    "city": "Fort Saint John",
    "country": "CA"
  },
  {
    "code": "YXK",
    "name": "Rimouski Airport",
    "city": "Rimouski",
    "country": "CA"
  },
  {
    "code": "YXL",
    "name": "Sioux Lookout Airport",
    "city": "Sioux Lookout",
    "country": "CA"
  },
  {
    "code": "YXQ",
    "name": "Beaver Creek Airport",
    "city": "Beaver Creek",
    "country": "CA"
  },
  {
    "code": "YXR",
    "name": "Earlton (Timiskaming Regional) Airport",
    "city": "Earlton",
    "country": "CA"
  },
  {
    "code": "YXS",
    "name": "Prince George (Intl) Airport",
    "city": "Prince George",
    "country": "CA"
  },
  {
    "code": "YXT",
    "name": "Northwest Regional Airport Terrace-Kitimat",
    "city": "Terrace",
    "country": "CA"
  },
  {
    "code": "YXU",
    "name": "London International Airport",
    "city": "London",
    "country": "CA"
  },
  {
    "code": "YXX",
    "name": "Abbotsford International Airport",
    "city": "Abbotsford",
    "country": "CA"
  },
  {
    "code": "YXY",
    "name": "Whitehorse / Erik Nielsen International Airport",
    "city": "Whitehorse",
    "country": "CA"
  },
  {
    "code": "YXZ",
    "name": "Wawa Airport",
    "city": "Wawa",
    "country": "CA"
  },
  {
    "code": "YYA",
    "name": "Yueyang Sanhe Airport",
    "city": "Yueyang (Yueyanglou)",
    "country": "CN"
  },
  {
    "code": "YYB",
    "name": "North Bay Jack Garland Airport",
    "city": "North Bay",
    "country": "CA"
  },
  {
    "code": "YYC",
    "name": "Calgary International Airport",
    "city": "Calgary",
    "country": "CA"
  },
  {
    "code": "YYD",
    "name": "Smithers Airport",
    "city": "Smithers",
    "country": "CA"
  },
  {
    "code": "YYE",
    "name": "Fort Nelson Airport",
    "city": "Fort Nelson",
    "country": "CA"
  },
  {
    "code": "YYF",
    "name": "Penticton Airport",
    "city": "Penticton",
    "country": "CA"
  },
  {
    "code": "YYG",
    "name": "Charlottetown Airport",
    "city": "Charlottetown",
    "country": "CA"
  },
  {
    "code": "YYJ",
    "name": "Victoria International Airport",
    "city": "Victoria",
    "country": "CA"
  },
  {
    "code": "YYL",
    "name": "Lynn Lake Airport",
    "city": "Lynn Lake",
    "country": "CA"
  },
  {
    "code": "YYN",
    "name": "Swift Current Airport",
    "city": "Swift Current",
    "country": "CA"
  },
  {
    "code": "YYQ",
    "name": "Churchill Airport",
    "city": "Churchill",
    "country": "CA"
  },
  {
    "code": "YYR",
    "name": "Goose Bay Airport",
    "city": "Goose Bay",
    "country": "CA"
  },
  {
    "code": "YYT",
    "name": "St. John's International Airport",
    "city": "St. John's",
    "country": "CA"
  },
  {
    "code": "YYU",
    "name": "Kapuskasing Airport",
    "city": "Kapuskasing",
    "country": "CA"
  },
  {
    "code": "YYW",
    "name": "Armstrong Airport",
    "city": "Armstrong",
    "country": "CA"
  },
  {
    "code": "YYY",
    "name": "Mont Joli Airport",
    "city": "Mont-Joli",
    "country": "CA"
  },
  {
    "code": "YYZ",
    "name": "Toronto Pearson International Airport",
    "city": "Toronto",
    "country": "CA"
  },
  {
    "code": "YZA",
    "name": "Cache Creek-Ashcroft Regional Airport",
    "city": "Cache Creek",
    "country": "CA"
  },
  {
    "code": "YZE",
    "name": "Gore Bay Manitoulin Airport",
    "city": "Gore Bay",
    "country": "CA"
  },
  {
    "code": "YZF",
    "name": "Yellowknife International Airport",
    "city": "Yellowknife",
    "country": "CA"
  },
  {
    "code": "YZH",
    "name": "Slave Lake Airport",
    "city": "Slave Lake",
    "country": "CA"
  },
  {
    "code": "YZP",
    "name": "Sandspit Airport",
    "city": "Sandspit",
    "country": "CA"
  },
  {
    "code": "YZR",
    "name": "Chris Hadfield Airport",
    "city": "Sarnia",
    "country": "CA"
  },
  {
    "code": "YZS",
    "name": "Coral Harbour Airport",
    "city": "Coral Harbour",
    "country": "CA"
  },
  {
    "code": "YZT",
    "name": "Port Hardy Airport",
    "city": "Port Hardy",
    "country": "CA"
  },
  {
    "code": "YZU",
    "name": "Whitecourt Airport",
    "city": "Whitecourt",
    "country": "CA"
  },
  {
    "code": "YZV",
    "name": "Sept-Îles Airport",
    "city": "Sept-Îles",
    "country": "CA"
  },
  {
    "code": "YZW",
    "name": "Teslin Airport",
    "city": "Teslin",
    "country": "CA"
  },
  {
    "code": "YZX",
    "name": "CFB Greenwood",
    "city": "Greenwood",
    "country": "CA"
  },
  {
    "code": "YZY",
    "name": "Zhangye Ganzhou Airport",
    "city": "Zhangye (Ganzhou)",
    "country": "CN"
  },
  {
    "code": "ZAD",
    "name": "Zadar Airport",
    "city": "Zadar",
    "country": "HR"
  },
  {
    "code": "ZAG",
    "name": "Zagreb Franjo Tuđman International Airport",
    "city": "Velika Gorica",
    "country": "HR"
  },
  {
    "code": "ZAH",
    "name": "Zahedan International Airport",
    "city": "Zahedan",
    "country": "IR"
  },
  {
    "code": "ZAL",
    "name": "Pichoy Airport",
    "city": "Valdivia",
    "country": "CL"
  },
  {
    "code": "ZAM",
    "name": "Zamboanga International Airport",
    "city": "Zamboanga",
    "country": "PH"
  },
  {
    "code": "ZAO",
    "name": "Cahors Lalbenque airport",
    "city": "Cahors",
    "country": "FR"
  },
  {
    "code": "ZAR",
    "name": "Zaria Airport",
    "city": "Zaria",
    "country": "NG"
  },
  {
    "code": "ZAT",
    "name": "Zhaotong Zhaoyang Airport （Not fully opened)",
    "city": "Zhaotong",
    "country": "CN"
  },
  {
    "code": "ZAZ",
    "name": "Zaragoza Airport",
    "city": "Zaragoza",
    "country": "ES"
  },
  {
    "code": "ZBF",
    "name": "Bathurst Airport",
    "city": "South Tetagouche",
    "country": "CA"
  },
  {
    "code": "ZBM",
    "name": "Bromont (Roland Désourdy) Airport",
    "city": "Bromont",
    "country": "CA"
  },
  {
    "code": "ZBR",
    "name": "Chabahar Konarak International Airport",
    "city": "Konarak",
    "country": "IR"
  },
  {
    "code": "ZCL",
    "name": "General Leobardo C. Ruiz International Airport",
    "city": "Zacatecas",
    "country": "MX"
  },
  {
    "code": "ZCO",
    "name": "La Araucanía Airport",
    "city": "Temuco",
    "country": "CL"
  },
  {
    "code": "ZEC",
    "name": "Secunda Airport",
    "city": "Secunda",
    "country": "ZA"
  },
  {
    "code": "ZEL",
    "name": "Bella Bella (Campbell Island) Airport",
    "city": "Bella Bella",
    "country": "CA"
  },
  {
    "code": "ZER",
    "name": "Ziro Airport",
    "city": "Ziro",
    "country": "IN"
  },
  {
    "code": "ZFA",
    "name": "Faro Airport",
    "city": "Faro",
    "country": "CA"
  },
  {
    "code": "ZGF",
    "name": "Grand Forks Airport",
    "city": "Grand Forks",
    "country": "CA"
  },
  {
    "code": "ZGU",
    "name": "Gaua Island Airport",
    "city": "Gaua Island",
    "country": "VU"
  },
  {
    "code": "ZHA",
    "name": "Zhanjiang Wuchuan Airport",
    "city": "Zhanjiang",
    "country": "CN"
  },
  {
    "code": "ZHY",
    "name": "Zhongwei Shapotou Airport",
    "city": "Zhongwei (Shapotou)",
    "country": "CN"
  },
  {
    "code": "ZIA",
    "name": "Zhukovsky International Airport",
    "city": "Moscow",
    "country": "RU"
  },
  {
    "code": "ZIC",
    "name": "Victoria Airport",
    "city": "Victoria",
    "country": "CL"
  },
  {
    "code": "ZIG",
    "name": "Ziguinchor Airport",
    "city": "Ziguinchor",
    "country": "SN"
  },
  {
    "code": "ZIH",
    "name": "Ixtapa-Zihuatanejo International Airport",
    "city": "Ixtapa",
    "country": "MX"
  },
  {
    "code": "ZIX",
    "name": "Zhigansk Airport",
    "city": "Zhigansk",
    "country": "RU"
  },
  {
    "code": "ZJG",
    "name": "Jenpeg Airport",
    "city": "Jenpeg",
    "country": "CA"
  },
  {
    "code": "ZJN",
    "name": "Swan River Airport",
    "city": "Swan River",
    "country": "CA"
  },
  {
    "code": "ZKP",
    "name": "Zyryanka Airport",
    "city": "Zyryanka",
    "country": "RU"
  },
  {
    "code": "ZLO",
    "name": "Playa de Oro International Airport",
    "city": "Manzanillo",
    "country": "MX"
  },
  {
    "code": "ZMT",
    "name": "Masset Airport",
    "city": "Masset",
    "country": "CA"
  },
  {
    "code": "ZND",
    "name": "Zinder Airport",
    "city": "Zinder",
    "country": "NE"
  },
  {
    "code": "ZNE",
    "name": "Newman Airport",
    "city": "Newman",
    "country": "AU"
  },
  {
    "code": "ZNZ",
    "name": "Abeid Amani Karume International Airport",
    "city": "Zanzibar",
    "country": "TZ"
  },
  {
    "code": "ZOS",
    "name": "Cañal Bajo Carlos Hott Siebert Airport",
    "city": "Osorno",
    "country": "CL"
  },
  {
    "code": "ZQN",
    "name": "Queenstown Airport",
    "city": "Queenstown",
    "country": "NZ"
  },
  {
    "code": "ZQZ",
    "name": "Zhangjiakou Ningyuan Airport",
    "city": "Zhangjiakou",
    "country": "CN"
  },
  {
    "code": "ZRH",
    "name": "Zürich Airport",
    "city": "Zurich",
    "country": "CH"
  },
  {
    "code": "ZRI",
    "name": "Stevanus Rumbewas Airport",
    "city": "Serui",
    "country": "ID"
  },
  {
    "code": "ZSA",
    "name": "San Salvador International Airport",
    "city": "San Salvador",
    "country": "BS"
  },
  {
    "code": "ZSE",
    "name": "Pierrefonds Airport",
    "city": "Saint-Pierre",
    "country": "RE"
  },
  {
    "code": "ZSJ",
    "name": "Sandy Lake Airport",
    "city": "Sandy Lake",
    "country": "CA"
  },
  {
    "code": "ZST",
    "name": "Stewart Airport",
    "city": "Stewart",
    "country": "CA"
  },
  {
    "code": "ZTH",
    "name": "Zakynthos International Airport Dionysios Solomos",
    "city": "Zakynthos",
    "country": "GR"
  },
  {
    "code": "ZTU",
    "name": "Zaqatala International Airport",
    "city": "Zaqatala",
    "country": "AZ"
  },
  {
    "code": "ZUC",
    "name": "Ignace Municipal Airport",
    "city": "Ignace",
    "country": "CA"
  },
  {
    "code": "ZUH",
    "name": "Zhuhai Jinwan Airport",
    "city": "Zhuhai (Jinwan)",
    "country": "CN"
  },
  {
    "code": "ZVA",
    "name": "Miandrivazo Airport",
    "city": "Miandrivazo",
    "country": "MG"
  },
  {
    "code": "ZVK",
    "name": "Savannakhet Airport",
    "city": null,
    "country": "LA"
  },
  {
    "code": "ZWA",
    "name": "Andapa Airport",
    "city": null,
    "country": "MG"
  },
  {
    "code": "ZXT",
    "name": "Zabrat Airport",
    "city": "Zabrat",
    "country": "AZ"
  },
  {
    "code": "ZYI",
    "name": "Zunyi Xinzhou Airport",
    "city": "Zunyi",
    "country": "CN"
  },
  {
    "code": "ZYL",
    "name": "Osmany International Airport",
    "city": "Sylhet",
    "country": "BD"
  },
  {
    "code": "ZZU",
    "name": "Mzuzu Airport",
    "city": "Mzuzu",
    "country": "MW"
  },
  {
    "code": "ZZV",
    "name": "Zanesville Municipal Airport",
    "city": "Zanesville",
    "country": "US"
  }
];
