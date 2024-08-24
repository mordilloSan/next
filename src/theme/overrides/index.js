// Override Imports
import Accordion from "./accordion";
import Alerts from "./alerts";
import Autocomplete from "./autocomplete";
import avatar from "./avatar";
import backdrop from "./backdrop";
import badges from "./badges";
import breadcrumbs from "./breadcrumbs";
import button from "./button";
import buttonGroup from "./button-group";
import card from "./card";
import Checkbox from "./checkbox";
import chip from "./chip";
import dialog from "./dialog";
import drawer from "./drawer";
import fab from "./fab";
import formControlLabel from "./form-control-label";
import iconButton from "./icon-button";
import input from "./input";
import list from "./list";
import menu from "./menu";
import pagination from "./pagination";
import paper from "./paper";
import popover from "./popover";
import progress from "./progress";
import Radio from "./radio";
import Rating from "./rating";
import Select from "./select";
import slider from "./slider";
import snackbar from "./snackbar";
import switchOverrides from "./switch";
import tablePagination from "./table-pagination";
import tabs from "./tabs";
import timeline from "./timeline";
import toggleButton from "./toggle-button";
import tooltip from "./tooltip";
import typography from "./typography";

const overrides = () => {
  return Object.assign(
    {},
    Accordion,
    Alerts,
    Autocomplete,
    avatar,
    backdrop,
    badges,
    breadcrumbs,
    button,
    buttonGroup,
    card,
    Checkbox,
    chip,
    dialog,
    drawer,
    fab,
    formControlLabel,
    iconButton,
    input,
    list,
    menu,
    pagination,
    paper,
    popover,
    progress,
    Radio,
    Rating,
    Select,
    slider,
    snackbar,
    switchOverrides,
    tablePagination,
    tabs,
    timeline,
    toggleButton,
    tooltip,
    typography,
  );
};

export default overrides;
