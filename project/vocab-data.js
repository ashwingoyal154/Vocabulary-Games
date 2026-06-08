/* GRE Vocabulary — meaning-family dataset.
 * Each cluster: { name, conn: '+'|'-'|null, words: [...] }
 * Word string prefixes encode role:
 *   "X "  -> antonym  (role 'x')
 *   "* "  -> near / slightly different (role 'n')
 *   "# "  -> unrelated, neither syn nor antonym (role 'u')
 *   (none)-> synonym  (role 's')
 */
(function () {
  const RAW = [
    { name: "LUCKY", conn: null, words: ["FORTUITOUS", "OPPORTUNE", "PROPITIOUS", "SERENDIPITY", "X DESPAIR", "X HAPLESS", "X WRETCHED"] },
    { name: "PAIN / SUFFERING", conn: "-", words: ["ADVERSITY", "AFFLICTION", "MISHAP", "ORDEAL", "TRIAL", "TRIBULATION"] },
    { name: "REMEMBERING THE PAST", conn: null, words: ["EVOCATIVE", "HINDSIGHT", "NOSTALGIA", "REMINISCENCE", "RETROSPECT", "WISTFUL"] },
    { name: "EXCESSIVE PATRIOTISM", conn: "-", words: ["CHAUVINISM", "FANATIC", "JINGOISM", "ZEALOT"] },
    { name: "VERY LITTLE", conn: "-", words: ["EXIGUOUS", "MEAGER", "PUNY", "SCANTY", "SKIMPY", "SPARE", "SPARSE"] },

    { name: "CUSTOMARY BEHAVIOR", conn: null, words: ["OBTAIN", "WONT"] },
    { name: "WEALTHY", conn: null, words: ["OPULENT", "AFFLUENT"] },
    { name: "INCREASE", conn: null, words: ["ACCRETION", "AGGRANDIZE", "AUGMENT", "BALLOON", "DILATE", "ENHANCE", "MOUNTING", "PROLIFERATE", "WAX"] },
    { name: "COMBINE", conn: null, words: ["AMALGAMATE", "COALITION", "MELD", "SYNTHESIS"] },
    { name: "REDUCE / RESTRICT", conn: null, words: ["CONSTRICT", "CONTRACT", "CURTAIL", "DWINDLE", "FLAG", "WANE"] },
    { name: "UNWILLING TO SPEND", conn: "-", words: ["CLOSEFISTED", "MISERLY", "NIGGARDLY", "PARSIMONIOUS", "SKINFLINT", "STINGY", "STINT", "TIGHTFISTED", "* THRIFT", "* FRUGAL"] },

    { name: "LESSEN IN INTENSITY", conn: null, words: ["ABATE", "EBB", "RECEDE", "SUBSIDE"] },
    { name: "RELEVANT", conn: null, words: ["APPOSITE", "APROPOS", "GERMANE", "PERTINENT"] },
    { name: "EXCESS", conn: null, words: ["ABOUND", "BARRAGE", "BOUNTEOUS", "COPIOUS", "GLUT", "INUNDATE", "MYRIAD", "PLETHORA", "PROFUSE", "PROLIFIC", "STEEPED", "SURFEIT", "SURGE", "TEEMING"] },
    { name: "UNCLEAR IN MEANING", conn: null, words: ["AMBIVALENT", "AMBIGUOUS", "EQUIVOCAL"] },
    { name: "EXPLAIN TOO MUCH", conn: null, words: ["BELABOR", "X UNDERSTATEMENT"] },
    { name: "CANNOT BE DEFEATED", conn: null, words: ["IMPERVIOUS", "INDOMITABLE", "INVINCIBLE"] },

    { name: "SHORTAGE / LACK OF", conn: "-", words: ["DEARTH", "DEFICIT", "PAUCITY", "VACUOUS"] },
    { name: "POOR", conn: "-", words: ["BANKRUPT", "DESTITUTE", "IMPECUNIOUS", "IMPOVERISHED", "INDIGENT", "INSOLVENT", "PENURY", "X SOLVENT"] },
    { name: "VERY HIGH PRICE", conn: "-", words: ["EXORBITANT", "GOUGING", "PROHIBITIVE"] },
    { name: "SPEND LAVISHLY / WASTE", conn: "-", words: ["PRODIGAL", "PROFLIGATE", "SPENDTHRIFT", "SQUANDER"] },
    { name: "SURE / CERTAIN", conn: null, words: ["ABSOLUTE", "CATEGORICAL", "CERTITUDE", "CONVICTION", "EMPHATIC", "INCONTROVERTIBLE", "UNQUALIFIED", "X CONTINGENT", "X PROVISIONAL", "X QUALIFY", "X TENTATIVE"] },
    { name: "NERVOUS / RESTLESS", conn: null, words: ["RESTIVE", "SKITTISH"] },

    { name: "GREED", conn: "-", words: ["AVARICE", "COVETOUS", "CUPIDITY", "RAPACIOUS", "RAVENOUS", "VORACIOUS"] },
    { name: "OVERLY NOISY", conn: "-", words: ["CACOPHONY", "CLAMOR", "CLANGOR", "DIN", "DISCORDANT", "OBSTREPEROUS", "RAUCOUS", "STRIDENT", "UPROAR", "VOCIFEROUS", "* BOISTEROUS", "# INAUDIBLE"] },
    { name: "PLEASANT SOUNDING", conn: "+", words: ["EUPHONY", "MELODIOUS", "MELLIFLUOUS"] },
    { name: "SUPPORTER", conn: null, words: ["ADVOCATE", "ALLY", "CHAMPION", "ENDORSE", "ESPOUSE", "LOBBYIST", "PROPONENT", "PROTAGONIST", "TOUT", "X ADVERSARY", "X ANTAGONIST", "X DETRACTOR", "X FOE", "X IMPUGN", "X INIMICAL", "X OPPONENT"] },

    { name: "PLANNED / DELIBERATE", conn: null, words: ["CALCULATED", "DELIBERATE", "FORETHOUGHT", "INTENTIONAL", "PREMEDITATED", "STUDIED", "X EXTEMPORANEOUS", "X IMPETUOUS", "X IMPROMPTU", "X IMPROVISE", "X OFFHAND"] },
    { name: "EXTRA / UNNECESSARY", conn: "-", words: ["EXTRANEOUS", "REDUNDANT", "SUPERFLUOUS"] },
    { name: "RESOLUTE / DETERMINED", conn: "+", words: ["DOGGED", "ENDURE", "IMMUTABLE", "INDEFATIGABLE", "PERSEVERE", "PERSISTENCE", "RESOLUTE", "STEADFAST", "TENACIOUS"] },
    { name: "TO OBJECT / RESIST", conn: null, words: ["DEFY", "DEMUR", "DISSENT", "QUIBBLE", "TAKE ISSUE WITH"] },
    { name: "TO MAKE UP / CREATE", conn: null, words: ["CONCOCT", "DEVISE", "FORMULATE"] },

    { name: "ACCEPT / AGREE / GIVE IN", conn: null, words: ["ACCEDE", "ACQUIESCE", "AMENABLE", "ASSENT", "COMPLIANT", "COMPLY", "CONCEDE", "CONCUR", "PLIANT", "RELENT", "SUCCUMB", "YIELD", "* DOCILE", "* MALLEABLE"] },
    { name: "TO DISPROVE", conn: null, words: ["BELIE", "DEBUNK", "DISCREDIT", "EXPOSTULATE", "REBUT", "REFUTE", "REMONSTRATE"] },
    { name: "CANCEL / TAKE BACK", conn: null, words: ["ANNUL", "DISAVOW", "GAINSAY", "NULLIFY", "RECANT", "RENEGE", "REPEAL", "REPUDIATE", "RESCIND", "RETRACT", "REVOKE", "VOID"] },

    { name: "ENERGIZING", conn: "+", words: ["GALVANIZING", "INVIGORATING", "REVITALIZING", "ROUSING"] },
    { name: "STUBBORN", conn: "-", words: ["ADAMANT", "DEFIANT", "INCORRIGIBLE", "INTRACTABLE", "INTRANSIGENT", "OBDURATE", "OBSTINATE", "PERTINACIOUS", "PERVERSE", "RECALCITRANT", "REFRACTORY", "WILLFUL"] },
    { name: "BREAK A RULE", conn: null, words: ["BREACH", "FLOUT", "TRANSGRESS", "X ABIDE", "X ADHERE"] },
    { name: "FAMOUS PERSON", conn: null, words: ["EMINENT", "LUMINARY", "PRE-EMINENT", "STATURE"] },

    { name: "DISLOYALTY", conn: "-", words: ["BETRAY", "INSIDIOUS", "PERFIDY", "X FEALTY", "X FIDELITY"] },
    { name: "JUST BEGINNING / DEVELOPING", conn: null, words: ["EMBRYONIC", "FLEDGLING", "INCHOATE", "INCIPIENT", "NASCENT", "RUDIMENTARY"] },
    { name: "EXPERIENCED", conn: "+", words: ["SEASONED", "VETERAN"] },
    { name: "EXPERT", conn: "+", words: ["CONNOISSEUR", "VIRTUOSO", "X LAYPERSON"] },
    { name: "SUMMARY", conn: null, words: ["CRUX", "GIST", "PRÉCIS", "PURPORT", "SYNOPSIS"] },
    { name: "FEELING GUILTY", conn: null, words: ["CONTRITE", "PENITENT", "REMORSE", "RUEFUL"] },
    { name: "GAP / PAUSE", conn: null, words: ["ABEYANCE", "HIATUS", "LULL", "MORATORIUM", "RESPITE"] },

    { name: "LOSE STRENGTH / WEAKEN", conn: "-", words: ["ATROPHY", "ATTENUATE", "ATTRITION", "DEBILITATE", "DEGENERATE", "DEGRADATION", "EFFETE", "ENERVATE", "ENFEEBLE", "FLAGGING", "SAP", "WILT", "WITHER"] },
    { name: "THRIVING / RESTORED", conn: "+", words: ["BURGEON", "REGENERATE", "REJUVENATE", "RESUSCITATE", "REVIVE"] },
    { name: "IDEALISTIC", conn: null, words: ["QUIXOTIC", "UTOPIAN"] },
    { name: "STRANGE / ODD", conn: null, words: ["ECCENTRIC", "FOIBLE", "IDIOSYNCRASY", "QUIRKINESS"] },
    { name: "DIFFICULT", conn: "-", words: ["ARDUOUS", "CUMBERSOME", "ENCUMBER", "EXACTING", "ONEROUS", "PONDEROUS", "X FACILE"] },
    { name: "RIGHT TO VOTE", conn: null, words: ["ENFRANCHISE", "SUFFRAGE"] },

    { name: "CORRECT / REPAIR", conn: null, words: ["AMEND", "ATONE", "DISABUSE", "EXPIATE", "INDEMNIFY", "REDEMPTION", "REDRESS", "REPARATION", "RESTITUTION"] },
    { name: "CLEAR (PHYSICAL & MEANING)", conn: "+", words: ["CLARITY", "ELUCIDATE", "EXPOSITION", "EXPOUND", "LIMPID", "LUCID", "PELLUCID"] },
    { name: "UNCLEAR / HAZY", conn: "-", words: ["AMORPHOUS", "BECLOUD", "CLOUD", "INDISTINCT", "MURKY", "NEBULOUS"] },
    { name: "CONFUSING SITUATION", conn: "-", words: ["DILEMMA", "PLIGHT", "PREDICAMENT", "QUANDARY"] },
    { name: "HAPPENING BEFORE", conn: null, words: ["ANTECEDENT", "FORERUNNER", "HARBINGER", "PRECEDENT", "PRECURSOR"] },

    { name: "IMMORAL", conn: "-", words: ["DEBAUCHERY", "DECADENT", "DEGENERATE", "DEPRAVITY", "DISSOLUTE", "IMPROBITY", "WAYWARD"] },
    { name: "WITHOUT MISTAKES / PERFECT", conn: "+", words: ["FLAWLESS", "IMMACULATE", "IMPECCABLE", "INFALLIBLE", "INTEGRITY", "IRREPROACHABLE", "PROBITY", "RECTITUDE", "UNIMPEACHABLE"] },
    { name: "RESTRAIN / CONFINE", conn: null, words: ["BRIDLE", "CIRCUMSCRIBE", "CONSTRAINT", "FETTER", "REIN", "SECURE", "SHACKLE", "X EXTRICATE"] },
    { name: "HARMFUL / CURSE", conn: "-", words: ["ANATHEMA", "BALEFUL", "BANE", "BLIGHT", "DELETERIOUS", "DETRIMENTAL", "MALEDICTION", "MALIGNANT", "PERNICIOUS"] },
    { name: "BORING & REPETITIOUS", conn: "-", words: ["MONOTONOUS", "PLOD", "TEDIOUS"] },

    { name: "CHAOS / CONFUSION", conn: "-", words: ["BEDLAM", "PANDEMONIUM", "TUMULTUOUS", "TURBULENCE", "TURMOIL", "UPHEAVAL"] },
    { name: "CRIMINALS / LAWBREAKERS", conn: "-", words: ["FELON", "MENACE", "MISCREANT", "ROGUE", "SCOUNDREL"] },
    { name: "CHEAT / DECEIVE", conn: "-", words: ["ARTFUL", "ARTIFICE", "BILK", "CHICANERY", "CRAFTY", "DUPLICITY", "DUPE", "FLEECE", "GUILE", "GULLED", "HOODWINK", "MISLEAD", "SWINDLE", "WILY"] },
    { name: "INNOCENT / WITHOUT DECEPTION", conn: null, words: ["ARTLESS", "CREDENCE", "CREDULOUS", "GUILELESS", "GULLIBLE", "INGENUOUS", "NAÏVE", "JEJUNE", "UNSOPHISTICATED"] },

    { name: "REPEAT", conn: null, words: ["RECAPITULATE", "REHASH", "REITERATE"] },
    { name: "DISASTER", conn: "-", words: ["CALAMITOUS", "CATACLYSM", "CATASTROPHE", "DEBACLE", "X COUP"] },
    { name: "DOUBTFUL", conn: "-", words: ["APPREHENSIVE", "CYNICAL", "DUBIOUS", "QUESTIONABLE", "SKEPTICAL"] },
    { name: "ACT PROPERLY / WELL-BEHAVED", conn: "+", words: ["DECOROUS", "DEMURE", "PRIM", "PROPRIETY", "SEEMLY", "X EXECRABLE", "X FLAGRANT", "X MALFEASANCE", "X UNBECOMING"] },
    { name: "SHINING", conn: "+", words: ["EFFULGENT", "LUMINOUS", "LUSTROUS", "SCINTILLATING"] },
    { name: "SELF-CONTROL", conn: "+", words: ["ABSTEMIOUS", "ABSTINENCE", "CELIBACY", "FORBEAR", "MODERATE", "REFRAIN", "TEMPERATE", "X INDULGE"] },

    { name: "PRACTICAL / POSSIBLE", conn: null, words: ["CONCEIVABLE", "CREDIBLE", "FEASIBLE", "PLAUSIBLE", "PRAGMATIC", "UTILITARIAN", "VERISIMILAR", "VIABLE"] },
    { name: "OVERLY PROUD", conn: "-", words: ["ARROGANT", "BOMBASTIC", "BRAGGART", "BRAVADO", "CONCEITED", "EGOTISTICAL", "HAUGHTY", "HUBRIS", "POMPOUS", "SUPERCILIOUS", "SWAGGER", "VAINGLORIOUS", "X UNASSUMING"] },
    { name: "LACK OF RESPECT", conn: "-", words: ["AUDACIOUS", "BRAZEN", "CHEEKY", "EFFRONTERY", "GALL", "IMPERTINENT", "IMPUDENT", "INSOLENT", "NERVE", "PRESUMPTUOUS", "TEMERITY"] },
    { name: "SHOW-OFF", conn: "-", words: ["FLAMBOYANCE", "FLAUNT", "GRANDILOQUENT", "GRANDIOSE", "OSTENTATIOUS", "PRETENTIOUS", "* PANACHE"] },

    { name: "TALKATIVE / WORDY", conn: null, words: ["GARRULOUS", "LOQUACIOUS", "PROLIX", "VERBIAGE", "VERBOSE", "VOLUBLE"] },
    { name: "SPEAK LESS / FEW WORDS", conn: null, words: ["ABBREVIATED", "ABRIDGE", "BREVITY", "CONDENSE", "LACONIC", "MONOSYLLABIC", "PITHY", "RETICENT", "SUCCINCT", "TACITURN"] },
    { name: "PRETENSE OF MORALITY", conn: "-", words: ["CANT", "HYPOCRITICAL", "PRIG", "PRUDE", "SANCTIMONIOUS"] },
    { name: "GENEROUS SUPPORTER", conn: "+", words: ["ALTRUIST", "BENEFACTOR", "BENEFICENT", "BENEVOLENT", "HUMANE", "MAGNANIMOUS", "MUNIFICENT", "PATRON", "PHILANTHROPIST"] }
  ];

  function parseWord(s) {
    if (s.startsWith("X ")) return { w: s.slice(2), role: "x" };
    if (s.startsWith("* ")) return { w: s.slice(2), role: "n" };
    if (s.startsWith("# ")) return { w: s.slice(2), role: "u" };
    return { w: s, role: "s" };
  }

  const CLUSTERS = RAW.map((c, i) => {
    const words = c.words.map(parseWord);
    return {
      id: i,
      name: c.name,
      conn: c.conn, // '+', '-', or null
      words,
      // eligible = synonym + near (the "members" of the family)
      members: words.filter((x) => x.role === "s" || x.role === "n").map((x) => x.w),
      antonyms: words.filter((x) => x.role === "x").map((x) => x.w)
    };
  });

  // Flat lookup of every unique displayable word -> its primary cluster + role
  const WORD_INDEX = {};
  CLUSTERS.forEach((c) => {
    c.words.forEach((x) => {
      const key = x.w;
      if (!WORD_INDEX[key]) WORD_INDEX[key] = [];
      WORD_INDEX[key].push({ clusterId: c.id, role: x.role });
    });
  });

  const ALL_MEMBER_WORDS = Object.keys(WORD_INDEX).filter((w) =>
    WORD_INDEX[w].some((e) => e.role === "s" || e.role === "n")
  );

  window.VOCAB = {
    CLUSTERS,
    WORD_INDEX,
    ALL_MEMBER_WORDS,
    // clusters that can host a 4-tile group in the Clusters game
    BIG_CLUSTERS: CLUSTERS.filter((c) => c.members.length >= 4),
    // clusters with antonyms (for the Antonym mode)
    ANTONYM_CLUSTERS: CLUSTERS.filter((c) => c.antonyms.length >= 1 && c.members.length >= 1)
  };
})();
