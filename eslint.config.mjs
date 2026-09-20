import nextVitals from "eslint-config-next/core-web-vitals";
export default [
  ...nextVitals,
  { ignores: [".next/**", ".data/**", "test-results/**", "node_modules/**"] },
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
];
