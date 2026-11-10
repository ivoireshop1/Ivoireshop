export type CheckoutDestination = {
  address_line_1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

function text(value?: string) {
  return (value ?? "").trim();
}

function isDomesticCountry(country?: string | null) {
  const value = (country ?? "").trim().toUpperCase();
  return value === "US" || value === "USA" || value === "UNITED STATES" || value === "UNITED STATES OF AMERICA";
}

function countryAlpha2(country?: string | null) {
  const value = (country ?? "").trim().toUpperCase();
  if (isDomesticCountry(value)) return "US";
  return value.slice(0, 2);
}

function needsCityState(country?: string | null) {
  const code = countryAlpha2(country);
  return code === "US" || code === "CA" || code === "MX" || code === "AU";
}

function validUsZip(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 5 || digits.length === 9;
}

function validCaPostal(value?: string | null) {
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(String(value ?? "").trim());
}

export function destinationReadyForLocalDelivery(destination: CheckoutDestination) {
  return Boolean(text(destination.city) && text(destination.postal_code) && text(destination.country));
}

export function destinationReadyForCarrierQuotes(destination: CheckoutDestination) {
  const country = text(destination.country);
  const postal = text(destination.postal_code);
  if (!text(destination.address_line_1) || !text(destination.city) || !country || !postal) return false;
  if (needsCityState(country) && !text(destination.state)) return false;
  if (isDomesticCountry(country) && !validUsZip(postal)) return false;
  if (countryAlpha2(country) === "CA" && !validCaPostal(postal)) return false;
  return true;
}

export function incompleteCarrierQuoteMessage(destination: CheckoutDestination) {
  if (destinationReadyForCarrierQuotes(destination)) return "";
  const country = countryAlpha2(destination.country);
  if (needsCityState(destination.country) && !text(destination.state)) {
    return "Enter the state or province with your complete street address before UPS and USPS rates can appear.";
  }
  if (isDomesticCountry(destination.country) && !text(destination.postal_code)) {
    return "Enter a U.S. ZIP code (5 digits) with your street address and city before UPS and USPS rates can appear.";
  }
  if (isDomesticCountry(destination.country) && !validUsZip(destination.postal_code)) {
    return "Enter a valid U.S. ZIP code (5 digits or ZIP+4) to see UPS and USPS rates.";
  }
  if (country === "CA" && !validCaPostal(destination.postal_code)) {
    return "Enter a complete Canadian postal code with the street, city, and province before UPS and USPS rates can appear.";
  }
  return "Enter a complete street address, city, postal code, and country to see UPS and USPS rates.";
}
