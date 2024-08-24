import Link from "next/link";
import { Breadcrumbs as MuiBreadcrumbs } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

function Breadcrumbs({ title, route }) {
  // Create the paths for the breadcrumbs
  const breadcrumbPaths = route.slice(0, -1).map((el, index) => {
    return {
      name: el,
      path: `/${route.slice(0, index + 1).join("/")}`,
    };
  });

  return (
    <Box mr={{ xs: 0, xl: 8 }}>
      <MuiBreadcrumbs>
        <Link href="/home">
          <HomeIcon sx={{ verticalAlign: "middle", marginBottom: "2px" }} />
        </Link>
        {breadcrumbPaths.map(({ name, path }) => (
          <Link href={path} key={name}>
            <Typography
              component="span"
              variant="button"
              fontWeight="regular"
              textTransform="capitalize"
              sx={{ lineHeight: 0 }}
            >
              {name.replace("-", " ")}
            </Typography>
          </Link>
        ))}
        <Typography
          fontWeight="bold"
          variant="h6"
          noWrap
          textTransform={route.length === 1 ? "capitalize" : "none"}
        >
          {title.replace("-", " ")}
        </Typography>
      </MuiBreadcrumbs>
    </Box>
  );
}

export default Breadcrumbs;
