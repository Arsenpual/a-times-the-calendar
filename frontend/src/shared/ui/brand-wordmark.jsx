import React from "react";

const base = `${import.meta.env.BASE_URL}logo/`;

export default function BrandWordmark({ className = "" }) {
  return (
    <span className={`brand-wordmark ${className}`} role="img" aria-label="T.i.M.E.S. — Time portal">
      <img className="brand-wordmark-light" src={`${base}time-portal.svg`} alt="" aria-hidden="true" width="512" height="512" />
      <img className="brand-wordmark-dark" src={`${base}time-portal-dark.svg`} alt="" aria-hidden="true" width="512" height="512" />
    </span>
  );
}
