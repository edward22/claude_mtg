import "./FairUseFooter.css";

export default function FairUseFooter() {
  return (
    <footer className="fair-use-footer">
      <p>
        MTG Sealed Simulator is unofficial Fan Content permitted under the{" "}
        <a href="https://company.wizards.com/en/legal/fancontentpolicy" target="_blank" rel="noreferrer">
          Wizards of the Coast Fan Content Policy
        </a>
        . Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast.
        ©Wizards of the Coast LLC.
      </p>
      <p>
        Card data and images courtesy of the{" "}
        <a href="https://scryfall.com/docs/api" target="_blank" rel="noreferrer">
          Scryfall API
        </a>
        .
      </p>
    </footer>
  );
}
