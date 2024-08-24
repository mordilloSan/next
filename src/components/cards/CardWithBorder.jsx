// CombinedComponent.js
import CardWithBorder from "./CardWithBorderRoot";
import CardWithHover from "./CardWithBorderHover";

const CombinedCard = (props) => {
  return (
    <CardWithHover>
      <CardWithBorder {...props} />
    </CardWithHover>
  );
};

export default CombinedCard;
