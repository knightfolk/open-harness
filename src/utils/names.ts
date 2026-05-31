// 8-character login handles — each a nod to a legendary coder, hacker, or pioneer.
// If you know, you know. 😉

const CODER_HANDLES: string[] = [
  // ── Pioneers — the ones who started it all ──────────────
  'lovelace', // Ada Lovelace — wrote the first algorithm (1843)
  'aturing0', // Alan Turing — the machine, the test, the everything
  'ghopper0', // Grace Hopper — first compiler, COBOL, literal "debug" (moth in relay)
  'babbage0', // Charles Babbage — the difference engine nobody built in his lifetime
  'tberners', // Tim Berners-Lee — invented the WWW, gave it away for free
  'vintcerf', // Vint Cerf — TCP/IP, one of the internet's fathers

  // ── Unix & C — the foundation everything runs on ───────
  'dritchie', // Dennis Ritchie — C, Unix, and therefore everything
  'bkernigh', // Brian Kernighan — K&R C, AWK (the k), "hello, world"
  'kthompso', // Ken Thompson — Unix, B, UTF-8, beat chess with code
  'donknuth', // Donald Knuth — TAoCP, TeX, stopped mid-book to invent a typesetter

  // ── Open source icons ──────────────────────────────────
  'stallman', // rms — GNU, Emacs, GPL, and your freedom to run programs
  'ltorvald', // Linus Torvalds — Linux, Git, and brutal mailing list reviews

  // ── Language creators ──────────────────────────────────
  'bstroust', // Bjarne Stroustrup — C++, "C makes it easy to shoot yourself in the foot"
  'mccarth0', // John McCarthy — LISP, coined "Artificial Intelligence" in 1955
  'nwirth00', // Niklaus Wirth — Pascal, "where there's a will there's a Wirth"
  'iverson0', // Kenneth Iverson — APL, the keyboard layout from another dimension
  'lwall000', // Larry Wall — Perl, "there's more than one way to do it"
  'ymatsum0', // Yukihiro Matsumoto — Ruby, "designed to make programmers happy"
  'dhh_rail', // DHH — Ruby on Rails, extracted from Basecamp in 2004

  // ── Cryptography — the ones who made privacy possible ──
  'diffie00', // Whitfield Diffie — public-key cryptography pioneer
  'hellman0', // Martin Hellman — Diffie-Hellman key exchange
  'rivest00', // Ron Rivest — the R in RSA
  'shamir00', // Adi Shamir — the S in RSA
  'adleman0', // Len Adleman — the A in RSA

  // ── AI & theory ────────────────────────────────────────
  'minsky00', // Marvin Minsky — AI pioneer, society of mind
  'alankay0', // Alan Kay — Smalltalk, "the best way to predict the future is to invent it"
  'backus00', // John Backus — FORTRAN, BNF notation

  // ── Systems, architecture & math ───────────────────────
  'lamport0', // Leslie Lamport — LaTeX, Paxos, "a distributed system is one in which..."
  'dengelbt', // Douglas Engelbart — the mother of all demos (1968)
  'hamming0', // Richard Hamming — error-correcting codes, "the purpose of computing is insight"
  'perlis00', // Alan Perlis — first Turing Award, "syntactic sugar causes cancer of the semicolon"
  'nygaard0', // Kristen Nygaard — Simula, birthed OOP on the world

  // ── Game dev, education & craft ────────────────────────
  'carmack0', // John Carmack — DOOM, Quake, fast inverse square root 0x5f3759df
  'abelson0', // Hal Abelson — SICP, "programs must be written for people to read"
  'sussman0', // Gerry Sussman — SICP, Scheme, the wizard book

  // ── In-jokes every nerd knows ──────────────────────────
  'segfault', // SIGSEGV — every C programmer's oldest friend
  'nullptr0', // Sir Tony Hoare's billion-dollar mistake (his words)
  'overflow', // stack overflow — the error, not the website
  'gotoless', // "Go To Statement Considered Harmful" — Dijkstra, 1968
  'eniac000', // ENIAC — first general-purpose electronic computer (1945)
];

export function randomAgentName(): string {
  return CODER_HANDLES[Math.floor(Math.random() * CODER_HANDLES.length)];
}
