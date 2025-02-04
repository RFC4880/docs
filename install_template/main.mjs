import fs from "fs/promises";
import { existsSync as fileExists } from "fs";
import path from "path";
import nunjucks from "nunjucks";
import prettier from "prettier";
import yaml from "yaml";

nunjucks.configure("templates", { throwOnUndefined: true, autoescape: false });

/**
 * Loop through the config.yaml file and generate docs for every product/platform/supported version combination found.
 * @returns void
 */
const run = async () => {
  const config = yaml.parse(await fs.readFile("config.yaml", "utf8"));

  config.products.forEach((product) => {
    product.platforms.forEach((platform) => {
      platform["supported versions"].forEach((version) => {
        renderDoc(product, platform, version);
      });
    });
  });

  return;
};

/**
 * Composes the code needed to render a single installation docuement for a product/platform/version combination.
 * @param product The product name we are generating a template for
 * @param platform The platform and architecture we are generating docs for (e.g. { name: Centos 7, arch: x86_64 })
 * @param version The version of the product to generate docs for
 * @returns void
 */
const renderDoc = (product, platform, version) => {
  console.log(
    `Starting render for ${product.name} ${version} on ${platform.name} ${platform.arch}`,
  );

  const template = findTemplate(
    product.name,
    version,
    platform.name,
    platform.arch,
  );

  if (template === false) {
    return;
  }

  console.log(`  using template "${template}"`);

  const context = generateContext(product, platform, version);

  try {
    writeDoc(template, context);
  } catch (error) {
    console.error("[ERROR] An exception occurred. Details below:");
    console.error(error);
    process.exit(1);
  }
};

/**
 * Find an appropriate template file based on the config information passed in
 * @param productName The product to render docs for. This is used as part of the path to the template file.
 * @param productVersion The version of the product to render docs for. Used in some of the filenames checked for.
 * @param platformName The name of the platform to render docs for. (e.g. Centos 7)
 * @param platformArch The archictecture of the platform to render docs for.
 * @returns The path to a applicable template file, or false if none is found.
 */
const findTemplate = (
  productName,
  productVersion,
  platformName,
  platformArch,
) => {
  const basePath = "products/" + formatStringForFile(productName);
  const formattedPlatform = formatStringForFile(platformName);

  // Check if a file exists for the specific product version, platform, and architecture
  const fullFilename = constructTemplatePath(basePath, [
    `v${productVersion}`,
    formattedPlatform,
    platformArch,
  ]);
  if (fileExists("templates/" + fullFilename)) {
    return fullFilename;
  }

  // Check if a file exists for the specific product version and platform
  const versionPlatformFilename = constructTemplatePath(basePath, [
    `v${productVersion}`,
    formattedPlatform,
  ]);
  if (fileExists("templates/" + versionPlatformFilename)) {
    return versionPlatformFilename;
  }

  // check if a file exists for a specific platform and architecture
  const platformArchFilename = constructTemplatePath(basePath, [
    formattedPlatform,
    platformArch,
  ]);
  if (fileExists("templates/" + platformArchFilename)) {
    return platformArchFilename;
  }

  // check if a file exists for a specific platform
  const platformFilename = constructTemplatePath(basePath, [formattedPlatform]);
  if (fileExists("templates/" + platformFilename)) {
    return platformFilename;
  }

  console.error(
    `[ERROR] no template could be found\n` +
      "  Please add one of the following files:\n" +
      `  ${fullFilename}\n` +
      `  ${versionPlatformFilename}\n` +
      `  ${platformArchFilename}\n` +
      `  ${platformFilename}\n`,
  );

  return false;
};

/**
 * Format a string into the format expected when used in file or folder names.
 * Converts a string to lowercase, and replaces all spaces with dashes
 * @param string
 * @returns a string formatted for file names
 */
const formatStringForFile = (string) => {
  return string.toLowerCase().replace(/ /g, "-");
};

/**
 * Creates a filename based on the filenameParts passed in, and appends to to a base path
 * @param basePath A file path formatted string which will be used as a prefix to the generated filename. e.g "products/product-name/"
 * @param filenameParts An array of strings to combine into a template name. e.g. ["first-part", "second", "last-part"]
 * @returns A file path which refers to the expected location of a nunjucks template, with each filename part seperated by an underscore.
 *          e.g. "products/product-name/first-part_second_last-part.njk"
 */
const constructTemplatePath = (basePath, filenameParts) => {
  return path.join(basePath, filenameParts.join("_") + ".njk");
};

/**
 * Creates the context object used by nunjucks templates
 * @param product The product to render docs for, from the config.
 * @param platform The platform to render docs for, from the config.
 * @param version The version of the product to render docs for
 * @returns a context object.
 */
const generateContext = (product, platform, version) => {
  return {
    product: {
      name: product.name,
      version: version,
    },
    platform: {
      name: platform.name,
      arch: platform.arch,
    },
  };
};

/**
 * actually render a nunjucks template with context, and write the result to the "/renders" folder.
 * @param template The path to a nunjucks tempalte to render.
 * @param context An object passed into the nunjucks template which will be used to render some variable content.
 */
const writeDoc = (template, context) => {
  const render = prettier.format(nunjucks.render(template, context), {
    parser: "mdx",
  });
  const filename =
    [
      formatStringForFile(context.product.name),
      context.product.version,
      formatStringForFile(context.platform.name),
      context.platform.arch,
    ].join("_") + ".mdx";

  console.log(`  writing ${filename}`);

  fs.writeFile(`renders/${filename}`, render);
};

run();
