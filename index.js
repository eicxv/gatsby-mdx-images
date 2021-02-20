const path = require("path");
const { slash } = require("gatsby-core-utils");
const { fluid } = require("gatsby-plugin-sharp");
const cheerio = require("cheerio");
const visit = require("unist-util-visit");
const definitions = require("mdast-util-definitions");
const isRelativeUrl = require("is-relative-url");

module.exports = async (
  { files, markdownNode, markdownAST, getNode, reporter, cache },
  pluginOptions
) => {
  const DEFAULT_OPTIONS = {
    elementName: "Img",
    fluid: {
      maxWidth: 800,
      quality: 80,
    },
  };

  const options = {
    ...DEFAULT_OPTIONS,
    ...pluginOptions,
    fluid: {
      ...DEFAULT_OPTIONS.fluid,
      ...pluginOptions.fluidOptions,
    },
  };

  function getNodes(ast) {
    let nodes = {
      jsx: [],
      image: [],
      imageReference: [],
    };
    visit(ast, Object.keys(nodes), (node) => {
      nodes[node.type].push(node);
    });
    const definition = definitions(ast);
    nodes.imageReference.map((imgRef) => {
      let def = definition(imgRef.identifier);
      imgRef.url = def.url;
      imgRef.title = def.title;
    });
    nodes = {
      jsx: nodes.jsx,
      markdown: nodes.image.concat(nodes.imageReference),
    };
    return nodes;
  }

  function getFileNode(src) {
    const parentNode = getNode(markdownNode.parent);
    if (!parentNode || !parentNode.dir) {
      return null;
    }

    filePath = slash(path.join(parentNode.dir, src));
    const fileNode = files.find((file) => file.absolutePath === filePath);

    return fileNode;
  }

  async function generateFluidResult(src, imgOptions = {}) {
    const imageNode = getFileNode(src);
    if (!imageNode) {
      return null;
    }
    const pathname = new URL(imageNode.absolutePath).pathname;
    const fileType = pathname.substring(pathname.lastIndexOf(".") + 1);
    // Ignore gifs as we can't process them,
    // svgs as they are already responsive by definition
    if (!isRelativeUrl(src) || fileType === "gif" || fileType === "svg") {
      return null;
    }
    if (!imageNode || !imageNode.absolutePath) {
      return null;
    }
    let fluidOptions = {
      ...options.fluid,
      ...imgOptions,
    };
    let fluidResult = await fluid({
      file: imageNode,
      args: fluidOptions,
      reporter,
      cache,
    });
    return fluidResult;
  }

  function insert(str, index, value) {
    return [str.substr(0, index), str.substr(index)].join(value);
  }

  async function mutateJsxNode(node) {
    const $ = cheerio.load(
      node.value,
      { xml: { withStartIndices: true } },
      false
    );
    const images = [];
    $(options.elementName).each(function () {
      images.push(this);
    });

    for (let img of images) {
      const src = img.attribs.src;
      let fluidOptions = {};
      if (img.fluid) {
        fluidOptions = JSON.parse(img.fluid);
      }

      const fluidResult = await generateFluidResult(src, fluidOptions);
      if (fluidResult) {
        let fluidAttr = ` fluid={${JSON.stringify(fluidResult)}} `;
        node.value = insert(
          node.value,
          img.startIndex + options.elementName.length + 1,
          fluidAttr
        );
      }
    }
  }

  async function mutateMarkdownNode(node) {
    const src = node.url;

    const fluidResult = await generateFluidResult(src);
    if (fluidResult) {
      const jsxTag = [
        `<${options.elementName}`,
        node.alt ? `alt="${node.alt}"` : "",
        node.title ? `title="${node.title}"` : "",
        `fluid={${JSON.stringify(fluidResult)}}>`,
        `</${options.elementName}>`,
      ].join(" ");

      node.type = "jsx";
      node.value = jsxTag;
    }
  }

  const nodes = getNodes(markdownAST);

  await Promise.all([
    Promise.all(nodes.jsx.map(mutateJsxNode)),
    Promise.all(nodes.markdown.map(mutateMarkdownNode)),
  ]);

  return markdownAST;
};
