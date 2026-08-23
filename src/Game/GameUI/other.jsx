/*! Open Historia — portions (mobile country/date row) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { JSON_URLS, readJson } from "../../runtime/assets.js";
import { isPolityLandless, readWorldState } from "../../runtime/gameState.js";
import { useIsMobile } from "../../runtime/useIsMobile.js";
import { useCountryDisplayName } from "../../runtime/polityNames.js";
import { flagEmojiFromGid, flagImageUrlFromGid } from "../../runtime/countryFlags.js";
import { loadPlayablePolities } from "../../runtime/playablePolities.js";
import { PLAYER_COUNTRY_CHANGED_EVENT, switchPlayerCountry } from "../../runtime/playerCountry.js";

const baseStyle = {
    backgroundColor: "rgba(17, 24, 39, 0.9)",
    backdropFilter: "blur(4px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontFamily: "sans-serif",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2)",
};

// A GID_0 that isn't a real ISO country (custom scenario polities like "HRE",
// "YUAN") has no flag — flagImageUrlFromGid/flagEmojiFromGid both return null
// for it, which this component uses directly as the fallback signal instead
// of maintaining a separate "is this a real country" check.
const FallbackBadge = ({ label }) => (
    <div
    title={label}
    style={{
        alignItems: "center",
        backgroundColor: "rgba(75, 85, 99, 0.9)",
        borderRadius: "50%",
        color: "white",
        display: "flex",
        fontSize: "1.1rem",
        fontWeight: 700,
        height: "100%",
        justifyContent: "center",
        width: "100%",
    }}
    >
    {label ? label.trim().charAt(0).toUpperCase() : "?"}
    </div>
);

const Other = memo(function Other({ rightShift = "0.5rem" }) {
    const [country, setCountry] = useState(null);
    const [countryOptions, setCountryOptions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [query, setQuery] = useState("");
    const [switchError, setSwitchError] = useState("");
    const containerRef = useRef(null);
    // A LANDLESS player is a stateless actor (a person, a movement, a
    // government-in-exile) whose game.country may still resolve to a real ISO
    // code — but they are NOT that country, so the badge must not borrow its
    // flag. Neutral placeholder instead. Refreshed on the same 5s cadence as the
    // stats pane so gaining/losing all territory flips the badge within a poll.
    const [landless, setLandless] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);
    const isMobile = useIsMobile();
    // The player sees the FULL country name in the tooltip, never the code.
    const displayName = useCountryDisplayName(country);
    const filteredCountries = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        if (!needle) return countryOptions;
        return countryOptions.filter((polity) => (
            polity.name.toLocaleLowerCase().includes(needle)
            || polity.code.toLocaleLowerCase().includes(needle)
        ));
    }, [countryOptions, query]);

    useEffect(() => {
        let cancelled = false;
        const refresh = async () => {
            try {
                const [data, world] = await Promise.all([
                    readJson(JSON_URLS.game, { defaultValue: {} }),
                    readWorldState({ force: false }),
                ]);
                if (cancelled) return;
                const code = data.country;
                setCountry(code);
                setLandless(isPolityLandless(world, code));
            } catch (err) {
                if (!cancelled) console.error("Failed to load game.json:", err);
            }
        };
        refresh();
        const intervalId = window.setInterval(refresh, 5000);
        return () => { cancelled = true; window.clearInterval(intervalId); };
    }, []);

    useEffect(() => {
        const handleCountryChanged = async (event) => {
            const nextCountry = event.detail?.country;
            if (!nextCountry) return;
            setCountry(nextCountry);
            try {
                const world = await readWorldState({ force: false });
                setLandless(isPolityLandless(world, nextCountry));
            } catch {
                // The regular refresh will retry without blocking the switch.
            }
        };
        window.addEventListener(PLAYER_COUNTRY_CHANGED_EVENT, handleCountryChanged);
        return () => window.removeEventListener(PLAYER_COUNTRY_CHANGED_EVENT, handleCountryChanged);
    }, []);

    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        loadPlayablePolities()
            .then((polities) => {
                if (!cancelled) setCountryOptions(polities);
            })
            .catch((error) => {
                if (!cancelled) setSwitchError(error.message || "Could not load countries.");
            });

        const handlePointerDown = (event) => {
            if (!containerRef.current?.contains(event.target)) setIsOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === "Escape") setIsOpen(false);
        };
        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            cancelled = true;
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    useEffect(() => {
        setImageFailed(false);
    }, [country]);

    // On phones the country is already shown inside the date widget — this
    // badge and the date widget would overlap on a portrait screen.
    if (isMobile || !country) return null;

    // Landless → never borrow the code-derived country flag; fall through to the
    // neutral FallbackBadge (both null makes the render pick it).
    const flagUrl = landless ? null : flagImageUrlFromGid(country);
    const flagEmoji = landless ? null : flagEmojiFromGid(country);

    const handleSwitch = async (nextCountry) => {
        if (!nextCountry || nextCountry === country || isSwitching) {
            setIsOpen(false);
            return;
        }
        const previousCountry = country;
        setCountry(nextCountry);
        setIsSwitching(true);
        setSwitchError("");
        try {
            await switchPlayerCountry(nextCountry);
            setIsOpen(false);
            setQuery("");
        } catch (error) {
            setCountry(previousCountry);
            setSwitchError(error.message || "Could not switch countries.");
        } finally {
            setIsSwitching(false);
        }
    };

    return (
        <div
        ref={containerRef}
        style={{
            position: "fixed",
            bottom: "4.75rem",
            right: rightShift,
            zIndex: 10000,
            transition: "right 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        >
        {isOpen ? (
            <div
            role="dialog"
            aria-label="Change active country"
            style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: "8px",
                bottom: "calc(100% + 0.5rem)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                boxSizing: "border-box",
                padding: "0.5rem",
                position: "absolute",
                right: 0,
                width: "15rem",
            }}
            >
            <input
            aria-label="Search countries"
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries"
            value={query}
            style={{
                background: "#0b1220",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "6px",
                boxSizing: "border-box",
                color: "white",
                font: "inherit",
                fontSize: "0.82rem",
                padding: "0.45rem 0.55rem",
                width: "100%",
            }}
            />
            <div
            role="listbox"
            aria-label="Countries"
            style={{ maxHeight: "17rem", marginTop: "0.4rem", overflowY: "auto" }}
            >
            {filteredCountries.map((polity) => {
                const selected = polity.code === country;
                return (
                    <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={isSwitching}
                    key={polity.code}
                    onClick={() => handleSwitch(polity.code)}
                    style={{
                        alignItems: "center",
                        background: selected ? "rgba(59,130,246,0.18)" : "transparent",
                        border: 0,
                        borderRadius: "6px",
                        color: selected ? "#bfdbfe" : "rgba(255,255,255,0.88)",
                        cursor: isSwitching ? "wait" : "pointer",
                        display: "flex",
                        font: "inherit",
                        fontSize: "0.82rem",
                        gap: "0.5rem",
                        padding: "0.42rem 0.5rem",
                        textAlign: "left",
                        width: "100%",
                    }}
                    >
                    <span aria-hidden="true" style={{ flexShrink: 0, width: "1.25rem" }}>
                    {flagEmojiFromGid(polity.code) || polity.name.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {polity.name}
                    </span>
                    {selected ? <span aria-hidden="true">✓</span> : null}
                    </button>
                );
            })}
            {filteredCountries.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.78rem", padding: "0.65rem 0.5rem" }}>
                No matching countries
                </div>
            ) : null}
            </div>
            {switchError ? (
                <div role="alert" style={{ color: "#fca5a5", fontSize: "0.76rem", padding: "0.45rem 0.5rem 0" }}>
                {switchError}
                </div>
            ) : null}
            </div>
        ) : null}
        <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Change active country. Currently ${displayName}`}
        disabled={isSwitching}
        onClick={() => {
            setSwitchError("");
            setIsOpen((open) => !open);
        }}
        title={`Play as ${displayName}`}
        style={{
            ...baseStyle,
            boxSizing: "border-box",
            cursor: isSwitching ? "wait" : "pointer",
            height: "2.75rem",
            overflow: "hidden",
            padding: "0.35rem",
            position: "relative",
            width: "2.75rem",
        }}
        >
        {flagUrl && !imageFailed ? (
            <img
            src={flagUrl}
            alt={displayName}
            onError={() => setImageFailed(true)}
            style={{ borderRadius: "50%", height: "100%", objectFit: "cover", width: "100%" }}
            />
        ) : flagEmoji ? (
            <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{flagEmoji}</span>
        ) : (
            <FallbackBadge label={displayName} />
        )}
        <span
        aria-hidden="true"
        style={{
            alignItems: "center",
            background: "rgba(3,7,18,0.82)",
            borderRadius: "4px",
            bottom: "0.1rem",
            display: "flex",
            fontSize: "0.55rem",
            height: "0.8rem",
            justifyContent: "center",
            lineHeight: 1,
            position: "absolute",
            right: "0.1rem",
            width: "0.8rem",
        }}
        >
        ▾
        </span>
        </button>
        </div>
    );
});

export { Other };
