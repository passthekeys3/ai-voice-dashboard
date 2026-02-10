/**
 * International Country Calling Code to IANA Timezone Mapping
 *
 * Maps ITU country calling codes to primary IANA timezone identifiers.
 * For countries spanning multiple timezones, the capital city's timezone is used.
 * +1 (NANP) is handled by area-codes.ts for more precise mapping.
 */

export const COUNTRY_CODE_TIMEZONES: Record<string, string> = {
  // North America (non-NANP)
  '52': 'America/Mexico_City',     // Mexico

  // Europe
  '30': 'Europe/Athens',           // Greece
  '31': 'Europe/Amsterdam',        // Netherlands
  '32': 'Europe/Brussels',         // Belgium
  '33': 'Europe/Paris',            // France
  '34': 'Europe/Madrid',           // Spain
  '36': 'Europe/Budapest',         // Hungary
  '39': 'Europe/Rome',             // Italy
  '40': 'Europe/Bucharest',        // Romania
  '41': 'Europe/Zurich',           // Switzerland
  '43': 'Europe/Vienna',           // Austria
  '44': 'Europe/London',           // United Kingdom
  '45': 'Europe/Copenhagen',       // Denmark
  '46': 'Europe/Stockholm',        // Sweden
  '47': 'Europe/Oslo',             // Norway
  '48': 'Europe/Warsaw',           // Poland
  '49': 'Europe/Berlin',           // Germany
  '350': 'Europe/Gibraltar',       // Gibraltar
  '351': 'Europe/Lisbon',          // Portugal
  '352': 'Europe/Luxembourg',      // Luxembourg
  '353': 'Europe/Dublin',          // Ireland
  '354': 'Atlantic/Reykjavik',     // Iceland
  '356': 'Europe/Malta',           // Malta
  '357': 'Asia/Nicosia',           // Cyprus
  '358': 'Europe/Helsinki',        // Finland
  '359': 'Europe/Sofia',           // Bulgaria
  '370': 'Europe/Vilnius',         // Lithuania
  '371': 'Europe/Riga',            // Latvia
  '372': 'Europe/Tallinn',         // Estonia
  '380': 'Europe/Kyiv',            // Ukraine
  '381': 'Europe/Belgrade',        // Serbia
  '385': 'Europe/Zagreb',          // Croatia
  '386': 'Europe/Ljubljana',       // Slovenia
  '387': 'Europe/Sarajevo',        // Bosnia
  '389': 'Europe/Skopje',          // North Macedonia
  '420': 'Europe/Prague',          // Czech Republic
  '421': 'Europe/Bratislava',      // Slovakia

  // Russia / CIS
  '7': 'Europe/Moscow',            // Russia (Moscow)
  '375': 'Europe/Minsk',           // Belarus
  '374': 'Asia/Yerevan',           // Armenia
  '994': 'Asia/Baku',              // Azerbaijan
  '995': 'Asia/Tbilisi',           // Georgia

  // Middle East
  '90': 'Europe/Istanbul',         // Turkey
  '92': 'Asia/Karachi',            // Pakistan
  '93': 'Asia/Kabul',              // Afghanistan
  '962': 'Asia/Amman',             // Jordan
  '963': 'Asia/Damascus',          // Syria
  '964': 'Asia/Baghdad',           // Iraq
  '965': 'Asia/Kuwait',            // Kuwait
  '966': 'Asia/Riyadh',            // Saudi Arabia
  '968': 'Asia/Muscat',            // Oman
  '970': 'Asia/Gaza',              // Palestine
  '971': 'Asia/Dubai',             // UAE
  '972': 'Asia/Jerusalem',         // Israel
  '973': 'Asia/Bahrain',           // Bahrain
  '974': 'Asia/Qatar',             // Qatar

  // South Asia
  '91': 'Asia/Kolkata',            // India
  '94': 'Asia/Colombo',            // Sri Lanka
  '95': 'Asia/Yangon',             // Myanmar
  '880': 'Asia/Dhaka',             // Bangladesh
  '977': 'Asia/Kathmandu',         // Nepal

  // East Asia
  '81': 'Asia/Tokyo',              // Japan
  '82': 'Asia/Seoul',              // South Korea
  '86': 'Asia/Shanghai',           // China
  '852': 'Asia/Hong_Kong',         // Hong Kong
  '853': 'Asia/Macau',             // Macau
  '886': 'Asia/Taipei',            // Taiwan

  // Southeast Asia
  '60': 'Asia/Kuala_Lumpur',       // Malaysia
  '62': 'Asia/Jakarta',            // Indonesia
  '63': 'Asia/Manila',             // Philippines
  '65': 'Asia/Singapore',          // Singapore
  '66': 'Asia/Bangkok',            // Thailand
  '84': 'Asia/Ho_Chi_Minh',        // Vietnam
  '855': 'Asia/Phnom_Penh',        // Cambodia
  '856': 'Asia/Vientiane',         // Laos

  // Oceania
  '61': 'Australia/Sydney',        // Australia
  '64': 'Pacific/Auckland',        // New Zealand
  '675': 'Pacific/Port_Moresby',   // Papua New Guinea
  '679': 'Pacific/Fiji',           // Fiji

  // Africa
  '20': 'Africa/Cairo',            // Egypt
  '27': 'Africa/Johannesburg',     // South Africa
  '212': 'Africa/Casablanca',      // Morocco
  '213': 'Africa/Algiers',         // Algeria
  '216': 'Africa/Tunis',           // Tunisia
  '218': 'Africa/Tripoli',         // Libya
  '220': 'Africa/Banjul',          // Gambia
  '221': 'Africa/Dakar',           // Senegal
  '223': 'Africa/Bamako',          // Mali
  '224': 'Africa/Conakry',         // Guinea
  '225': 'Africa/Abidjan',         // Ivory Coast
  '226': 'Africa/Ouagadougou',     // Burkina Faso
  '227': 'Africa/Niamey',          // Niger
  '228': 'Africa/Lome',            // Togo
  '229': 'Africa/Porto-Novo',      // Benin
  '230': 'Indian/Mauritius',       // Mauritius
  '231': 'Africa/Monrovia',        // Liberia
  '232': 'Africa/Freetown',        // Sierra Leone
  '233': 'Africa/Accra',           // Ghana
  '234': 'Africa/Lagos',           // Nigeria
  '237': 'Africa/Douala',          // Cameroon
  '243': 'Africa/Kinshasa',        // DR Congo
  '244': 'Africa/Luanda',          // Angola
  '247': 'Atlantic/Ascension',     // Ascension
  '248': 'Indian/Mahe',            // Seychelles
  '249': 'Africa/Khartoum',        // Sudan
  '250': 'Africa/Kigali',          // Rwanda
  '251': 'Africa/Addis_Ababa',     // Ethiopia
  '252': 'Africa/Mogadishu',       // Somalia
  '253': 'Africa/Djibouti',        // Djibouti
  '254': 'Africa/Nairobi',         // Kenya
  '255': 'Africa/Dar_es_Salaam',   // Tanzania
  '256': 'Africa/Kampala',         // Uganda
  '260': 'Africa/Lusaka',          // Zambia
  '261': 'Indian/Antananarivo',    // Madagascar
  '263': 'Africa/Harare',          // Zimbabwe
  '264': 'Africa/Windhoek',        // Namibia
  '265': 'Africa/Blantyre',        // Malawi
  '266': 'Africa/Maseru',          // Lesotho
  '267': 'Africa/Gaborone',        // Botswana
  '268': 'Africa/Mbabane',         // Eswatini

  // South America
  '54': 'America/Argentina/Buenos_Aires', // Argentina
  '55': 'America/Sao_Paulo',       // Brazil
  '56': 'America/Santiago',        // Chile
  '57': 'America/Bogota',          // Colombia
  '58': 'America/Caracas',         // Venezuela
  '51': 'America/Lima',            // Peru
  '53': 'America/Havana',          // Cuba
  '591': 'America/La_Paz',         // Bolivia
  '592': 'America/Guyana',         // Guyana
  '593': 'America/Guayaquil',      // Ecuador
  '595': 'America/Asuncion',       // Paraguay
  '597': 'America/Paramaribo',     // Suriname
  '598': 'America/Montevideo',     // Uruguay

  // Central America
  '501': 'America/Belize',         // Belize
  '502': 'America/Guatemala',      // Guatemala
  '503': 'America/El_Salvador',    // El Salvador
  '504': 'America/Tegucigalpa',    // Honduras
  '505': 'America/Managua',        // Nicaragua
  '506': 'America/Costa_Rica',     // Costa Rica
  '507': 'America/Panama',         // Panama
};
