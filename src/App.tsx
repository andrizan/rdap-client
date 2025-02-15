import { useState } from "react";

type VCard = {
  name?: string;
  organization?: string;
  email?: string;
  phone?: string;
  address?: string[];
  title?: string;
};

type RDAPResponse = {
  handle?: string;
  ldhName?: string;
  entities?: Array<{
    handle: string;
    vcardArray?: Array<VCard>;
    roles?: string[];
  }>;
  events?: Array<{
    eventAction: string;
    eventDate: string;
  }>;
  status?: string[];
  port43: string;
  lang: string;
  notices?: Array<{
    title: string;
    description: string[];
  }>;
  secureDNS?: {
    delegationSigned: boolean;
    dsData?: Array<{
      keyTag: number;
      algorithm: number;
      digestType: number;
      digest: string;
    }>;
  };
  nameservers?: Array<{
    ldhName: string;
    handle: string;
    ipAddresses?: {
      v4?: string[];
      v6?: string[];
    };
    status?: string[];
  }>;
};

const RDAPLookup = () => {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RDAPResponse | null>(null);
  const [searched, setSearched] = useState(false);

  const fetchRDAP = async () => {
    if (!domain) return;

    setLoading(true);
    setError("");
    setResult(null);
    setSearched(true);

    try {
      const response = await fetch(`https://rdap.org/domain/${domain}`);
      if (!response.ok) {
        throw new Error("Domain not found or RDAP lookup failed");
      }
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatRDAPResult = (data: RDAPResponse | null): string => {
    if (!data) return "Domain lookup failed or no data available.";

    let output = "=== RDAP Domain Lookup Result ===\n";
    output += `Domain Name: ${data.ldhName || "N/A"}\n`;
    output += `Handle: ${data.handle || "N/A"}\n`;
    output += `Status: ${data.status?.join(", ") || "N/A"}\n`;
    output += `Whois Server: ${data.port43 || "N/A"}\n`;
    output += `Lang: ${data.lang || "N/A"}\n`;

    if (data.events?.length) {
      output += "\n--- Important Dates ---\n";
      data.events.forEach((event) => {
        output += `${event.eventAction}: ${new Date(
          event.eventDate
        ).toLocaleString()}\n`;
      });
    }

    type EntityRole = "registrant" | "technical" | "registrar";

    if (data.entities?.length) {
      const groupedEntities = data.entities.reduce((acc, entity) => {
        entity.roles?.forEach((role) => {
          if (
            role === "registrant" ||
            role === "technical" ||
            role === "registrar"
          ) {
            acc[role] = entity;
          }
        });
        return acc;
      }, {} as Record<EntityRole, (typeof data.entities)[0]>);

      output += "\n--- Contact Information ---\n";

      ["registrant", "technical", "registrar"].forEach((role) => {
        const entity = groupedEntities[role as EntityRole];
        if (entity) {
          output += `\n${role.toUpperCase()} Contact:\n`;
          output += `Handle: ${entity.handle}\n`;

          if (entity.vcardArray && Array.isArray(entity.vcardArray[1])) {
            entity.vcardArray[1].forEach((item: any) => {
              if (Array.isArray(item) && item.length >= 4) {
                const [prop, , , value] = item;
                switch (prop) {
                  case "fn":
                    output += `Name: ${value}\n`;
                    break;
                  case "org":
                    output += `Organization: ${value}\n`;
                    break;
                  case "email":
                    output += `Email: ${value}\n`;
                    break;
                  case "tel":
                    output += `Phone: ${value}\n`;
                    break;
                  case "adr":
                    if (Array.isArray(value)) {
                      output += `Address: ${value
                        .filter(Boolean)
                        .join(", ")}\n`;
                    }
                    break;
                }
              }
            });
          }
        }
      });
    }

    if (data.secureDNS) {
      output += "\n--- Secure DNS ---\n";
      output += `Delegation Signed: ${data.secureDNS.delegationSigned}\n`;
      data.secureDNS.dsData?.forEach((ds) => {
        output += `Key Tag: ${ds.keyTag}, Algorithm: ${ds.algorithm}, Digest: ${ds.digest}\n`;
      });
    }

    if (data.nameservers?.length) {
      output += "\n--- Nameservers ---\n";
      data.nameservers.forEach((ns) => {
        output += `Nameserver: ${ns.ldhName}\nHandle: ${ns.handle}\nIPv4: ${
          ns.ipAddresses?.v4?.join(", ") || "N/A"
        }\nIPv6: ${ns.ipAddresses?.v6?.join(", ") || "N/A"}\n\n`;
      });
    }

    if (data.notices?.length) {
      output += "\n--- Notices ---\n";
      data.notices.forEach((notice) => {
        output += `Title: ${
          notice.title
        }\nDescription: ${notice.description.join(" ")}\n\n`;
      });
    }

    return output;
  };

  const handleDownload = () => {
    if (!result) return;
    const text = formatRDAPResult(result);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${domain}-rdap.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gray-50">
      <div className="w-full max-w-4xl mx-auto p-6 space-y-6 flex-1">
        <div
          className={`text-center transition-all ${
            searched ? "mt-0" : "mt-40"
          }`}
        >
          <h1 className="text-3xl font-bold mb-4 text-gray-800">RDAP Domain Lookup</h1>
          <div className="flex gap-2 justify-center">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Enter domain name..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none border-gray-300 focus:ring-1 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && fetchRDAP()}
            />
            <button
              onClick={fetchRDAP}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
      </div>

      {result && (
        <div className="max-w-4xl mx-auto bg-gray-100 p-4 my-12 rounded-lg border text-sm font-mono whitespace-pre-wrap ">
          {formatRDAPResult(result)}
          <button
            onClick={handleDownload}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-950"
          >
            Download Result
          </button>
        </div>
      )}
      <footer className="w-full py-4 text-center text-gray-700 border-t border-gray-200 font-mono">
        Version:{" "}
        <span className="font-bold">v1#{__COMMIT_HASH__ || "unknown"}</span>
      </footer>
    </div>
  );
};

export default RDAPLookup;
