import React from "react";

const base = `${import.meta.env.BASE_URL}logo/`;

export default function BrandWordmark({ className = "" }) {
  return (
    <span className={`brand-wordmark ${className}`} role="img" aria-label="T.i.M.E.S.">
      <img className="brand-wordmark-light" src={`${base}times-original/times-wordmark.svg`} alt="" aria-hidden="true" width="640" height="220" />
      <img className="brand-wordmark-dark" src={`${base}times-original/times-wordmark-dark.svg`} alt="" aria-hidden="true" width="640" height="220" />
    </span>
  );
}
