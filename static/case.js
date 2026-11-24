// Generated from data/case.json by scripts/build-case.js. Edit the JSON, then regenerate.
const CASE_DATA = {
  "_notice": "Entirely fictional. Names, handles, IPs (RFC 5737), wallets, domains (.example, RFC 2606) and images are invented for teaching.",
  "applicant": {
    "name": "Daniel Whitmore",
    "role": "Senior Blockchain Engineer (remote)",
    "company": "Northwind Ledger Ltd",
    "stated_location": "Lisbon, Portugal",
    "applied": "2026-10-02"
  },
  "anchor": {
    "type": "email",
    "value": "dwhitmore.dev@mail.example",
    "label": "Application email (anchor)"
  },
  "sources": [
    {
      "name": "application",
      "label": "Application pack",
      "types": [
        "email"
      ]
    },
    {
      "name": "breach",
      "label": "Breach corpus",
      "types": [
        "email",
        "handle"
      ]
    },
    {
      "name": "social",
      "label": "Profile lookup",
      "types": [
        "email",
        "phone"
      ]
    },
    {
      "name": "github",
      "label": "GitHub API",
      "types": [
        "github",
        "ssh_key"
      ]
    },
    {
      "name": "whois",
      "label": "WHOIS / RDAP",
      "types": [
        "domain"
      ]
    },
    {
      "name": "passive_dns",
      "label": "Passive DNS",
      "types": [
        "domain",
        "nameserver"
      ]
    },
    {
      "name": "phone_intel",
      "label": "Phone intelligence",
      "types": [
        "phone"
      ]
    },
    {
      "name": "image",
      "label": "Reverse image search",
      "types": [
        "image"
      ]
    },
    {
      "name": "ip_intel",
      "label": "IP / ASN intelligence",
      "types": [
        "ip"
      ]
    },
    {
      "name": "blockchain",
      "label": "Blockchain explorer",
      "types": [
        "wallet"
      ]
    }
  ],
  "records": [
    {
      "id": "R00",
      "source": "application",
      "match": {
        "type": "email",
        "value": "dwhitmore.dev@mail.example"
      },
      "title": "Application pack",
      "attribution": "strong",
      "detail": "The applicant's CV, application form and onboarding documents supplied these identifiers.",
      "returns": [
        {
          "type": "phone",
          "value": "+1 555-0142",
          "label": "Application phone",
          "attribution": "strong"
        },
        {
          "type": "github",
          "value": "dwhitmore-dev",
          "label": "GitHub handle (from CV)",
          "attribution": "strong"
        },
        {
          "type": "domain",
          "value": "whitmore-blockchain.example",
          "label": "Portfolio website",
          "attribution": "strong"
        },
        {
          "type": "image",
          "value": "img:sha256:ab12cd34ef56",
          "label": "Application headshot",
          "attribution": "strong"
        },
        {
          "type": "ip",
          "value": "203.0.113.47",
          "label": "IP of video interview",
          "attribution": "strong"
        },
        {
          "type": "wallet",
          "value": "0xA11CE000000000000000000000000000000000B1",
          "label": "Payroll wallet (onboarding form)",
          "attribution": "strong"
        }
      ]
    },
    {
      "id": "R01",
      "source": "breach",
      "match": {
        "type": "email",
        "value": "dwhitmore.dev@mail.example"
      },
      "title": "2 breach hits",
      "attribution": "strong",
      "detail": "Appears in a 2019 forum dump under the alias dwhitmore_crypto. Password hash matches one reused across two leaks.",
      "returns": [
        {
          "type": "handle",
          "value": "dwhitmore_crypto",
          "label": "Forum alias"
        }
      ]
    },
    {
      "id": "R02",
      "source": "social",
      "match": {
        "type": "email",
        "value": "dwhitmore.dev@mail.example"
      },
      "title": "Gravatar links to GitHub",
      "attribution": "strong",
      "detail": "The Gravatar image hash is also used by GitHub account dwhitmore-dev.",
      "returns": [
        {
          "type": "github",
          "value": "dwhitmore-dev",
          "label": "GitHub account"
        }
      ]
    },
    {
      "id": "R03",
      "source": "github",
      "match": {
        "type": "github",
        "value": "dwhitmore-dev"
      },
      "title": "Commit metadata",
      "attribution": "strong",
      "detail": "Commits are authored under an alias, jin.sk.dev@mail.example. Commit times cluster in UTC+9 working hours. The timezone alone is a weak signal. The account's SSH key is the one that matters.",
      "returns": [
        {
          "type": "email",
          "value": "jin.sk.dev@mail.example",
          "label": "Commit author alias"
        },
        {
          "type": "ssh_key",
          "value": "SHA256:xK3vQ9mT2fLr8WpZ1cYdN4hB7sJa0eG6uKoR5iVtPw",
          "label": "SSH public key"
        }
      ]
    },
    {
      "id": "R04",
      "source": "github",
      "match": {
        "type": "ssh_key",
        "value": "SHA256:xK3vQ9mT2fLr8WpZ1cYdN4hB7sJa0eG6uKoR5iVtPw"
      },
      "title": "Same SSH key on a second account",
      "attribution": "strong",
      "detail": "The same public key authorises the account jhkim-chain. The applicant's identity has a second persona.",
      "returns": [
        {
          "type": "github",
          "value": "jhkim-chain",
          "label": "Second GitHub account"
        }
      ]
    },
    {
      "id": "R05",
      "source": "whois",
      "match": {
        "type": "domain",
        "value": "whitmore-blockchain.example"
      },
      "title": "Registrant and nameserver",
      "attribution": "strong",
      "detail": "Registered 9 days before the application. Registrant contact is jin.sk.dev@mail.example, the same alias as in the commits. Nameserver is shared with other sites.",
      "returns": [
        {
          "type": "email",
          "value": "jin.sk.dev@mail.example",
          "label": "Registrant contact"
        },
        {
          "type": "nameserver",
          "value": "ns1.bulkhost.example",
          "label": "Nameserver"
        }
      ]
    },
    {
      "id": "R14",
      "source": "breach",
      "match": {
        "type": "email",
        "value": "jin.sk.dev@mail.example"
      },
      "title": "Alias in a 2021 leak",
      "attribution": "strong",
      "detail": "The same alias appears in a 2021 forum dump, under a third handle, with a recruiter-style profile in Korean.",
      "returns": [
        {
          "type": "handle",
          "value": "jin-sk-dev",
          "label": "Third handle"
        }
      ]
    },
    {
      "id": "R06",
      "source": "passive_dns",
      "match": {
        "type": "nameserver",
        "value": "ns1.bulkhost.example"
      },
      "title": "Shared nameserver",
      "attribution": "strong",
      "detail": "Hosts three recently registered blockchain career sites that share one job-posting template.",
      "returns": [
        {
          "type": "domain",
          "value": "crypto-advisors-hub.example",
          "label": ""
        },
        {
          "type": "domain",
          "value": "defi-careers-lab.example",
          "label": ""
        }
      ]
    },
    {
      "id": "R07",
      "source": "whois",
      "match": {
        "type": "domain",
        "value": "crypto-advisors-hub.example"
      },
      "title": "Checkout wallet",
      "attribution": "strong",
      "detail": "The site's 'consulting fee' page pays into a wallet that is tagged in our advisory.",
      "returns": [
        {
          "type": "wallet",
          "value": "0x5F3C00000000000000000000000000000000E9",
          "label": "Advisory-tagged wallet"
        }
      ]
    },
    {
      "id": "R08",
      "source": "passive_dns",
      "match": {
        "type": "domain",
        "value": "defi-careers-lab.example"
      },
      "title": "Same job template",
      "attribution": "weak",
      "detail": "Uses a generic 'remote blockchain developer' template that thousands of legitimate sites also use.",
      "returns": []
    },
    {
      "id": "R09",
      "source": "phone_intel",
      "match": {
        "type": "phone",
        "value": "+1 555-0142"
      },
      "title": "VoIP number on a freelance profile",
      "attribution": "strong",
      "detail": "Non-geographic VoIP number. It is also listed on a freelance marketplace under the name 'Jin-hyeok K.' with the handle jhkim-chain.",
      "returns": [
        {
          "type": "github",
          "value": "jhkim-chain",
          "label": "Freelance profile handle"
        }
      ]
    },
    {
      "id": "R10",
      "source": "image",
      "match": {
        "type": "image",
        "value": "img:sha256:ab12cd34ef56"
      },
      "title": "Headshot belongs to someone else",
      "attribution": "strong",
      "detail": "The photo first appears on the profile of a real engineer in Lisbon with no link to this case. Treat that person as a victim of identity misuse. Do not contact them during an investigation.",
      "returns": [
        {
          "type": "handle",
          "value": "lbernardi-eng",
          "label": "Original photo owner"
        }
      ],
      "media": [
        {
          "src": "evidence/headshot-submitted.svg",
          "caption": "Headshot as submitted with the application (placeholder)"
        },
        {
          "src": "evidence/headshot-original.svg",
          "caption": "Original photo on another engineer's profile (placeholder). That person is a victim; do not contact them."
        }
      ]
    },
    {
      "id": "R11",
      "source": "ip_intel",
      "match": {
        "type": "ip",
        "value": "203.0.113.47"
      },
      "title": "Residential proxy ASN",
      "attribution": "strong",
      "detail": "AS64500 'ResiProxy Holdings' is a residential proxy pool, geolocated to Lisbon. The same IP was used for two other applications.",
      "returns": [
        {
          "type": "email",
          "value": "recruit.oa.22@mail.example",
          "label": "Other applicant 1"
        },
        {
          "type": "email",
          "value": "a.park.hire@mail.example",
          "label": "Other applicant 2"
        },
        {
          "type": "ip",
          "value": "198.51.100.20",
          "label": "Neighbouring IP",
          "attribution": "weak"
        }
      ]
    },
    {
      "id": "R12",
      "source": "ip_intel",
      "match": {
        "type": "ip",
        "value": "198.51.100.20"
      },
      "title": "Shared coworking space",
      "attribution": "weak",
      "detail": "A coworking-space address in Lisbon with 40+ unrelated users. Being on the same IP is not evidence on its own. This is the false-positive trap.",
      "returns": [
        {
          "type": "email",
          "value": "m.okafor.dev@mail.example",
          "label": "Unrelated coworker"
        }
      ]
    },
    {
      "id": "R13",
      "source": "blockchain",
      "match": {
        "type": "wallet",
        "value": "0xA11CE000000000000000000000000000000000B1"
      },
      "title": "Payroll wallet cluster",
      "attribution": "strong",
      "detail": "Funds were sent to this wallet from a cluster in which one wallet is in our advisory.",
      "returns": [
        {
          "type": "wallet",
          "value": "0x5F3C00000000000000000000000000000000E9",
          "label": "Cluster member"
        }
      ]
    }
  ],
  "advisory_iocs": [
    {
      "type": "ssh_key",
      "value": "SHA256:xK3vQ9mT2fLr8WpZ1cYdN4hB7sJa0eG6uKoR5iVtPw",
      "label": "Key used by a known IT-worker operation"
    },
    {
      "type": "wallet",
      "value": "0x5F3C00000000000000000000000000000000E9",
      "label": "Laundering cluster wallet"
    },
    {
      "type": "domain",
      "value": "crypto-advisors-hub.example",
      "label": "Front site for IT-worker recruitment"
    },
    {
      "type": "ip",
      "value": "203.0.113.47",
      "label": "Residential proxy egress used by IT workers"
    }
  ],
  "roots": [
    {
      "type": "email",
      "value": "dwhitmore.dev@mail.example",
      "label": "Application email (anchor)"
    },
    {
      "type": "phone",
      "value": "+1 555-0142",
      "label": "Application phone"
    },
    {
      "type": "github",
      "value": "dwhitmore-dev",
      "label": "GitHub handle (from CV)"
    },
    {
      "type": "domain",
      "value": "whitmore-blockchain.example",
      "label": "Portfolio website"
    },
    {
      "type": "image",
      "value": "img:sha256:ab12cd34ef56",
      "label": "Application headshot"
    },
    {
      "type": "ip",
      "value": "203.0.113.47",
      "label": "IP of video interview"
    },
    {
      "type": "wallet",
      "value": "0xA11CE000000000000000000000000000000000B1",
      "label": "Payroll wallet (onboarding form)"
    }
  ]
};

if (typeof module !== "undefined") module.exports = { CASE_DATA };
