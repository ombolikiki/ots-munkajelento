// Belépési pont: a Microsoft-bejelentkezés felugró ablakában az átirányított oldal csak visszaküldi a kódot, és bezárja magát;
// egyébként elindul az alkalmazás.
import { handlePopupReturn } from "./calendarAuth.js";

if (!handlePopupReturn()) import("./app.js");
