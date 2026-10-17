import React from "react";

const base = `${import.meta.env.BASE_URL}logo/`;

export default function BrandWordmark({ className = "" }) {
  return (
    <span className={`brand-wordmark ${className}`} role="img" aria-label="TXph">
      <img className="brand-wordmark-light" src={`${base}txph-wordmark.svg`} alt="" aria-hidden="true" width="352" height="108" />
      <img className="brand-wordmark-dark" src={`${base}txph-wordmark-dark.svg`} alt="" aria-hidden="true" width="352" height="108" />
    </span>
  );
}
