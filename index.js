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
    replaceMarkdownImageParent: true,
    fluid: {
      maxWidth: 800,
      quality: 80,
    },
    output: {
      base64: true,
      withWebp: false,
      limitPresentationSize: false,
    },
  };

  const options = {
    ...DEFAULT_OPTIONS,
    ...pluginOptions,
    fluid: {
      ...DEFAULT_OPTIONS.fluid,
      ...pluginOptions.fluid,
    },
    output: {
      ...DEFAULT_OPTIONS.output,
      ...pluginOptions.output,
    },
  };

  function replaceMarkdownParent(node, parent) {
    if (node.type !== "jsx") {
      parent.type = "div";
    }
  }

  function getNodes(ast) {
    let nodes = {
      jsx: [],
      image: [],
      imageReference: [],
    };
    visit(ast, Object.keys(nodes), (node, index, parent) => {
      nodes[node.type].push(node);
      if (options.replaceMarkdownImageParent) {
        replaceMarkdownParent(node, parent);
      }
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

  async function generateFluidResult(src, imageOptions = {}) {
    const imageNode = getFileNode(src);
    if (!imageNode || !imageNode.absolutePath) {
      return null;
    }
    let fluidOptions = {
      ...options.fluid,
      ...imageOptions.fluid,
    };
    let outputOptions = {
      ...options.output,
      ...imageOptions.output,
    };
    let result = await fluid({
      file: imageNode,
      args: fluidOptions,
      reporter,
      cache,
    });

    result = {
      aspectRatio: result.aspectRatio,
      sizes: result.sizes,
      src: result.src,
      srcSet: result.srcSet,
      ...(outputOptions.base64 && { base64: result.base64 }),
      ...(outputOptions.limitPresentationSize && {
        maxHeight: result.presentationHeight,
        maxWidth: result.presentationWidth,
      }),
    };
    if (outputOptions.withWebp) {
      let webpResult = await fluid({
        file: imageNode,
        args: { ...fluidOptions, toFormat: "WEBP" },
        reporter,
        cache,
      });
      result.srcWebp = webpResult.src;
      result.srcSetWebp = webpResult.srcSet;
    }
    return result;
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

    for (let img of images.reverse()) {
      const src = img.attribs.src;
      let imageOptions = {};
      if (img.attribs["image-options"]) {
        imageOptions = JSON.parse(img.attribs["image-options"]);
      }

      const fluidResult = await generateFluidResult(src, imageOptions);
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
