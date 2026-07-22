import { Link } from "wouter";

const FOOTER_LINKS = [
  { label: "Privacy Policy",      href: "/privacy-policy" },
  { label: "Terms of Service",    href: "/terms-of-service" },
  { label: "Refund Policy",       href: "/refund-policy" },
  { label: "Cancellation Policy", href: "/cancellation-policy" },
  { label: "Contact Us",          href: "/contact-us" },
  { label: "About Us",            href: "/about-us" },
  { label: "FAQ",                 href: "/faq" },
];

export default function Footer({ className = "" }: { className?: string }) {
  return (
    <footer className={`border-t bg-card py-6 px-4 mt-auto ${className}`}>
      <div className="max-w-[1280px] mx-auto space-y-3">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <img src="/logo-icon.png" alt="GovtGuru" width={32} height={32} className="rounded-md" />
          <p className="text-sm font-bold text-foreground">GovtGuru</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center text-xs text-muted-foreground">
          {FOOTER_LINKS.map(link => (
            <Link key={link.href} href={link.href}>
              <span className="hover:text-foreground hover:underline cursor-pointer transition-colors">
                {link.label}
              </span>
            </Link>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          © 2026 GovtGuru by Digi Tech India. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
