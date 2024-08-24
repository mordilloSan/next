const LayoutWrapper = (props) => {
  const { verticalLayout } = props;

  return <div className="flex flex-col flex-auto">{verticalLayout}</div>;
};

export default LayoutWrapper;
